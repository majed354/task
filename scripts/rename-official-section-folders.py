#!/usr/bin/env python3
"""Rename only reviewed sections, keeping registry identities and delivery evidence."""
import argparse
import csv
import io
import json
import os
import re
from pathlib import Path
from build_official_sections import register_signature

TEAM = Path('/Users/majd/Library/CloudStorage/OneDrive-TaifUniversity/كلية الشريعة والأنظمة — الجودة والاعتماد - متابعة تقارير المقررات')
TRIAL = Path('/Users/majd/Desktop/claudeMe/الإطلاق التجريبي/runtime/committee-execution/registry')
REG = TEAM / '0-الأدلة-والقوالب/قوائم-المقررات'
DEPTS = {'SHR':'قسم الشريعة', 'LAW':'قسم الأنظمة', 'QRA':'قسم القراءات', 'ISC':'قسم الثقافة الإسلامية'}
DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩','0123456789')
FIELDS = ('مسار_الشعبة','تقرير_الشعبة','قياس_مخرجات_الشعبة')

def atomic(path, data):
    temp = path.with_name(path.name + '.official-rename.tmp')
    temp.write_bytes(data)
    os.replace(temp, path)

def csv_bytes(fields, rows):
    stream = io.StringIO(newline='')
    writer = csv.DictWriter(stream, fieldnames=fields)
    writer.writeheader(); writer.writerows(rows)
    return stream.getvalue().encode('utf-8-sig')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--audit', type=Path, required=True)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    if args.audit.exists() and json.loads(args.audit.read_text()).get('state')!='planned':
        raise ValueError('A completed migration audit already exists; use a new audit for new data')
    mapping = json.loads((REG/'مطابقة-أرقام-الشعب-من-النتائج.json').read_text())
    matches = {(x['term'],x['department'],x['code'],x['section']):x for x in mapping['entries']}
    records = {}; plans = []; writes = {}; originals = {}
    for path in sorted(REG.glob('سجل-الشعب-*.csv')):
        with path.open(encoding='utf-8-sig',newline='') as stream:
            reader = csv.DictReader(stream); rows = list(reader); fields = reader.fieldnames
        with (TRIAL/path.name).open(encoding='utf-8-sig',newline='') as stream:
            if list(csv.DictReader(stream)) != rows:
                raise ValueError('Trial registry differs from Team registry: '+path.name)
        for row in rows:
            key = (row['الفصل'].translate(DIGITS),DEPTS[row['رمز_القسم']],row['رمز_المقرر'],row['الشعبة_التنظيمية'])
            entry = matches[key]
            if register_signature(row) != entry['registerSignature'] or row['عضو_هيئة_التدريس'] != entry['member']:
                raise ValueError('Reviewed section assignment changed')
            if entry['status'] != 'matched': continue
            if row['رقم_الشعبة_الرسمي'] != entry['officialSection']: raise ValueError('Official number changed')
            old = Path(row['مسار_الشعبة'])
            if not re.fullmatch(r'ش\d+-.*',old.name): raise ValueError('Unrecognized section folder')
            new = old.with_name('ش'+entry['officialSection']+'-'+old.name.split('-',1)[1])
            if old == new: continue
            if not (TEAM/old).is_dir() or (TEAM/old).is_symlink() or (TEAM/new).exists():
                raise ValueError('Missing source or occupied destination: '+str(old))
            if str(old).startswith('1-التقارير/'+row['الفصل']+'/') is False or '..' in old.parts:
                raise ValueError('Folder outside registered term')
            inventory = []
            for file in sorted((TEAM/old).rglob('*')):
                if file.is_symlink(): raise ValueError('Unexpected symlink')
                if file.is_file():
                    rel=file.relative_to(TEAM/old).as_posix()
                    stat=file.stat()
                    # Preserve cloud placeholders without forcing evidence downloads.
                    inventory.append({'file':rel,'inode':stat.st_ino,'size':stat.st_size})
            plans.append({'term':row['الفصل'],'code':row['رمز_المقرر'],'department':row['رمز_القسم'],
                          'section':row['الشعبة_التنظيمية'],'officialSection':entry['officialSection'],
                          'old':old.as_posix(),'new':new.as_posix(),'files':inventory})
            for field in FIELDS:
                if row[field] != str(old) and not row[field].startswith(str(old)+'/'):
                    raise ValueError('Unexpected registered folder reference')
                row[field]=str(new)+row[field][len(str(old)):]
        records[path]=(fields,rows)
        for target in (path,TRIAL/path.name):
            originals[target]=target.read_bytes(); writes[target]=csv_bytes(fields,rows)
    if len({x['new'] for x in plans}) != len(plans): raise ValueError('Duplicate destination')
    audit={'schema':'official-folder-renames-v1','state':'planned','renames':plans}
    args.audit.parent.mkdir(parents=True,exist_ok=True)
    args.audit.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
    print('Reviewed renames:',len(plans),flush=True)
    if not args.apply:return
    backup=args.audit.parent/(args.audit.stem+'-before')
    if backup.exists():raise ValueError('Backup already exists; inspect previous run')
    backup.mkdir()
    for i,(path,data) in enumerate(originals.items()):
        (backup/str(i)).write_bytes(data)
    (backup/'index.json').write_text(json.dumps([str(p) for p in originals],ensure_ascii=False,indent=2))
    moved=[]; completed=[]
    try:
        for item in plans:
            (TEAM/item['old']).rename(TEAM/item['new']); moved.append(item)
        # Update both registry copies only after every move succeeds.
        for path,data in writes.items():atomic(path,data);completed.append(path)
        for item in plans:
            root=TEAM/item['new']
            actual={p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}
            if actual!={f['file'] for f in item['files']}:raise ValueError('Folder contents changed')
            for file in item['files']:
                path=root/file['file']
                stat=path.stat()
                if (stat.st_ino,stat.st_size)!=(file['inode'],file['size']):raise ValueError('Evidence identity or size changed')
        audit['state']='applied';audit['verifiedFiles']=sum(len(x['files']) for x in plans)
        args.audit.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
        print('Renamed and verified:',len(plans),'files:',audit['verifiedFiles'],flush=True)
    except Exception:
        for item in reversed(moved): (TEAM/item['new']).rename(TEAM/item['old'])
        for path,data in originals.items():atomic(path,data)
        audit['state']='rolled-back'
        args.audit.write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
        raise

if __name__=='__main__':main()
