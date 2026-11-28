#!/usr/bin/env python3
"""Match Team folder records to official section headers in the supplied results.

Read-only for raw sources and section registers. No student names, IDs or grades
are written. Ambiguous assignments remain unresolved; folder IDs stay unchanged.
Run with the bundled Python (lxml) and --output to save the reviewed mapping.
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import re
import unicodedata
from pathlib import Path

TEAM = Path('/Users/majd/Library/CloudStorage/OneDrive-TaifUniversity/كلية الشريعة والأنظمة — الجودة والاعتماد - متابعة تقارير المقررات')
REGISTERS = TEAM / '0-الأدلة-والقوالب/قوائم-المقررات'
RESULTS = Path('/Users/majd/Desktop/claudeMe/أتمتة التقارير/المدخلات ')
DEPARTMENTS = {'SHR': 'قسم الشريعة', 'LAW': 'قسم الأنظمة', 'QRA': 'قسم القراءات', 'ISC': 'قسم الثقافة الإسلامية'}
DIGITS = str.maketrans('٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789')
TERMS = {('1446', '1'): '461', ('1446', '2'): '462', ('1447', '1'): '471', ('1447', '2'): '472'}


def clean(value: str) -> str:
    return re.sub(r'\s+', ' ', value.replace('\xa0', ' ')).strip()


def normalize_name(value: str) -> str:
    value = unicodedata.normalize('NFKC', clean(value))
    value = re.sub(r'^(?:أ\.\s*د\.|ا\.\s*د\.|د\.|أ\.|ا\.)\s*', '', value)
    value = value.translate(str.maketrans('أإآٱىةؤئ', 'اااايهوي')).translate(DIGITS)
    return ''.join(c for c in value.casefold() if c.isalnum() and not unicodedata.combining(c))


def label(value: str) -> str:
    return clean(value).rstrip(':：').replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا')


def after(values: list[str], wanted: str) -> str:
    for index, value in enumerate(values[:-1]):
        if label(value) == wanted:
            return values[index + 1]
    return ''


def campus(value: str) -> str:
    return 'طالبات' if 'طالبات' in value else 'طلاب'


def extract_sources(root: Path) -> tuple[list[dict], list[dict]]:
    from lxml import etree
    sections = {}
    sources = []
    seen_files = set()
    for path in sorted(root.rglob('*.xls')):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        sources.append({'path': str(path.relative_to(root)), 'sha256': digest, 'duplicate': digest in seen_files})
        if digest in seen_files:
            continue
        seen_files.add(digest)
        head = path.read_bytes()[:8192]
        encoding_match = re.search(br'charset\s*=\s*[\x22\x27]?([a-z0-9._-]+)', head, re.I)
        if not head.lstrip().startswith(b'<!DOCTYPE HTML') or not encoding_match:
            raise ValueError(f'Unsupported results format: {path.name}')
        encoding = encoding_match.group(1).decode('ascii')
        state = {}
        active = None
        for row_number, (_, row) in enumerate(etree.iterparse(str(path), events=('end',), tag='tr', html=True, recover=True, huge_tree=True, encoding=encoding), 1):
            cells = [clean(''.join(cell.itertext())) for cell in row if cell.tag.lower() in ('td', 'th')]
            values = [value for value in cells if value]
            labels = {label(value) for value in values}
            for value in values:
                if 'للفصل الدراسي' in value:
                    year = re.search(r'14\d{2}', value.translate(DIGITS))
                    semester = '1' if 'الاول' in label(value) else '2' if 'الثاني' in value else ''
                    state = {'term': TERMS.get((year.group() if year else '', semester), '')}
                    active = None
            if {'مقر', 'شعبة'} <= labels:
                state.update(campus=after(values, 'مقر'), section=after(values, 'شعبة').translate(DIGITS))
                active = None
            if {'المقرر', 'المدرس'} <= labels:
                full_code = after(values, 'المقرر').translate(DIGITS)
                code_match = re.fullmatch(r'(\d{5,9})(?:\s*[-–—]\s*\d{1,3})?', full_code)
                name_index = next(i for i, value in enumerate(values) if label(value) == 'المقرر') + 2
                if state.get('term') and code_match and re.fullmatch(r'\d+', state.get('section', '')):
                    key = (state['term'], full_code, campus(state['campus']), state['section'])
                    active = sections.setdefault(key, {'term': state['term'], 'code': code_match.group(1), 'fullCode': full_code,
                        'name': values[name_index], 'campus': campus(state['campus']), 'section': state['section'],
                        'members': set(), 'students': set(), 'evidence': []})
                    active['members'].add(after(values, 'المدرس'))
                    trace = {'file': str(path.relative_to(root)), 'sha256': digest, 'row': row_number}
                    if not active['evidence'] or active['evidence'][-1]['file'] != trace['file']:
                        active['evidence'].append(trace)
            # Count unique enrolments only in memory; never persist student data.
            if active is not None and len(values) >= 4:
                for index in range(len(values) - 2):
                    if re.fullmatch(r'\d{1,5}', values[index].translate(DIGITS)) and re.fullmatch(r'\d{6,14}', values[index + 1].translate(DIGITS)):
                        active['students'].add(values[index + 1].translate(DIGITS))
                        break
            row.clear()
            parent = row.getparent()
            if parent is not None:
                while row.getprevious() is not None:
                    del parent[0]
        print(f'Extracted section headers: {path.name}', flush=True)
    return [{**entry, 'members': sorted(entry['members']), 'students': len(entry['students'])} for entry in sections.values()], sources


def match_sections(registers: list[dict], results: list[dict]) -> list[dict]:
    groups = collections.defaultdict(list)
    candidates = collections.defaultdict(list)
    for row in registers:
        groups[(row['term'], row['code'], normalize_name(row['member']), row['campus'])].append(row)
    for result in results:
        for member in result['members']:
            candidates[(result['term'], result['code'], normalize_name(member), result['campus'])].append(result)
            if result.get('fullCode') and result['fullCode'] != result['code']:
                candidates[(result['term'], result['fullCode'], normalize_name(member), result['campus'])].append(result)
    output = []
    for key, rows in groups.items():
        choices = candidates.get(key, [])
        # Do not merge separate faculty identities that normalize alike.
        identities = {row['member'] for row in rows}
        assignments = {}
        if len(identities) == 1:
            if len(rows) == len(choices) == 1:
                assignments[rows[0]['section']] = (choices[0], 'unique')
            else:
                for row in rows:
                    selected = [entry for entry in choices if entry['students'] == row['students']]
                    peers = [peer for peer in rows if peer['students'] == row['students']]
                    if len(selected) == len(peers) == 1:
                        assignments[row['section']] = (selected[0], 'student-count')
                used = {id(entry) for entry, _ in assignments.values()}
                remaining_rows = [row for row in rows if row['section'] not in assignments]
                remaining_choices = [entry for entry in choices if id(entry) not in used]
                if len(remaining_rows) == len(remaining_choices) == 1:
                    assignments[remaining_rows[0]['section']] = (remaining_choices[0], 'remaining-unique')
        for row in rows:
            selected, basis = assignments.get(row['section'], (None, ''))
            if selected is None and row.get('previous'):
                # Verify an already recorded official number against its raw header.
                # This is limited to that number, never a global abbreviated-name alias.
                words = [normalize_name(word) for word in re.sub(r'^(?:أ\.\s*د\.|ا\.\s*د\.|د\.)\s*', '', clean(row['member'])).split()]
                known = [entry for entry in results if entry['term'] == row['term'] and entry.get('fullCode' if '-' in row['code'] else 'code') == row['code'] and entry['campus'] == row['campus'] and entry['section'] == row['previous']
                         and any(normalize_name(member) == normalize_name(row['member']) or (len(words) >= 3 and all(word in normalize_name(member) for word in words)) for member in entry['members'])]
                if len(known) == 1:
                    selected, basis = known[0], 'registered-official-source'
            # Result numbers are the authority; conflicting pre-existing values need review.
            if selected and row.get('previous') and row['previous'] != selected['section']:
                selected, basis = None, ''
            output.append({'term': row['term'], 'code': row['code'], 'department': row['department'], 'section': row['section'], 'member': row['member'],
                'officialSection': selected['section'] if selected else '',
                'status': 'matched' if selected else 'ambiguous' if choices else 'missing', 'basis': basis,
                'candidates': sorted({entry['section'] for entry in choices} | ({selected['section']} if selected else set()), key=int),
                'sources': selected['evidence'] if selected else [],
                'registerStudents': row['students'], 'resultStudents': selected['students'] if selected else None,
                'registerSignature': row['signature']})
    # One physical section must not be assigned to two different folder records.
    assigned = collections.defaultdict(list)
    for entry in output:
        if entry['officialSection']:
            assigned[(entry['term'], entry['code'], entry['officialSection'])].append(entry)
    for duplicates in assigned.values():
        if len(duplicates) > 1:
            for entry in duplicates:
                entry.update(officialSection='', status='ambiguous', basis='', sources=[])
    return output


def register_signature(row: dict) -> str:
    return hashlib.sha256(json.dumps({key: row[key] for key in ['الفصل', 'رمز_القسم', 'رمز_المقرر', 'الشعبة_التنظيمية', 'عضو_هيئة_التدريس', 'الفرع', 'عدد_الطلاب']}, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


def read_registers(root: Path) -> list[dict]:
    rows = []
    for term in ['461', '462', '471', '472']:
        arabic = term.translate(str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩'))
        with (root / f'سجل-الشعب-{arabic}.csv').open(encoding='utf-8-sig', newline='') as stream:
            for row in csv.DictReader(stream):
                rows.append({'term': term, 'code': row['رمز_المقرر'], 'department': DEPARTMENTS[row['رمز_القسم']], 'section': row['الشعبة_التنظيمية'],
                    'member': row['عضو_هيئة_التدريس'], 'campus': campus(row['الفرع']), 'students': int(row['عدد_الطلاب']),
                    'previous': row['رقم_الشعبة_الرسمي'].translate(DIGITS).strip(), 'signature': register_signature(row)})
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--results', type=Path, default=RESULTS)
    parser.add_argument('--registers', type=Path, default=REGISTERS)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--apply', action='store_true', help='Fill only matched official-number fields in the derived Team registers; preserve all folder references')
    args = parser.parse_args()
    results, sources = extract_sources(args.results)
    matches = match_sections(read_registers(args.registers), results)
    payload = {'schema': 'official-sections-v1', 'sources': sources, 'entries': matches,
        'summary': {term: dict(collections.Counter(entry['status'] for entry in matches if entry['term'] == term)) for term in ['461', '462', '471', '472']}}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    args.output.chmod(0o600)
    if args.apply:
        by_key = {(entry['term'], entry['department'], entry['code'], entry['section']): entry for entry in matches if entry['status'] == 'matched'}
        backup = args.output.parent / 'official-sections-registers-before'
        backup.mkdir(parents=True, exist_ok=True)
        for path in sorted(args.registers.glob('سجل-الشعب-*.csv')):
            with path.open(encoding='utf-8-sig', newline='') as stream:
                reader = csv.DictReader(stream)
                fields = reader.fieldnames
                rows = list(reader)
            if not (backup / path.name).exists():
                (backup / path.name).write_bytes(path.read_bytes())
            for row in rows:
                key = (row['الفصل'].translate(DIGITS), DEPARTMENTS[row['رمز_القسم']], row['رمز_المقرر'], row['الشعبة_التنظيمية'])
                entry = by_key.get(key)
                if entry:
                    if register_signature(row) != entry['registerSignature']:
                        raise ValueError('A section register changed during matching')
                    row['رقم_الشعبة_الرسمي'] = entry['officialSection']
            with path.open('w', encoding='utf-8-sig', newline='') as stream:
                writer = csv.DictWriter(stream, fieldnames=fields)
                writer.writeheader()
                writer.writerows(rows)
    print(json.dumps({'resultSections': len(results), **payload['summary']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
