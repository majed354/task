#!/usr/bin/env python3
"""Import six verified 1447-2 reports from the September OneDrive ZIP exports."""

from __future__ import annotations

import argparse
import csv
import hashlib
import os
import unicodedata
from pathlib import Path
from zipfile import ZipFile


WORKSPACE = Path(__file__).resolve().parents[2]
SOURCE_DIR = WORKSPACE / "تقارير المقررات الجديدة"
TEAM = Path(
    "/Users/majd/Library/CloudStorage/OneDrive-TaifUniversity/"
    "كلية الشريعة والأنظمة — الجودة والاعتماد - متابعة تقارير المقررات"
)
REGISTER = TEAM / "0-الأدلة-والقوالب/قوائم-المقررات/سجل-الشعب-٤٧٢.csv"
ARCHIVE = TEAM / "0-الأدلة-والقوالب/مصادر-تقارير-1447-نسخ-دون-تعديل/حزم-2026-09-27"
AUDIT = TEAM / "2-المتابعة/سجل-إضافة-تقارير-2026-09-28.csv"

# (ZIP, department, course, section or None for the combined course report, source filename)
SELECTION = (
    ("OneDrive_1_27-9-2026 (1).zip", "QRA", "2002308", "001", "تقرير المقرر عرض القراءات السبع  4.docx"),
    ("OneDrive_1_27-9-2026 (1).zip", "QRA", "2002308", "002", "تقرير مقرر عرض القراءات السبع(4) طالبات.docx"),
    ("OneDrive_1_27-9-2026 (1).zip", "QRA", "2002308", None, "‏‏تقرير المقرر عرض القراءات السبع  4 - منسق.docx"),
    ("OneDrive_1_27-9-2026 (1).zip", "QRA", "2002307", None, "تقرير مقرر فرش القراءات السبع(4).docx"),
    ("OneDrive_1_27-9-2026.zip", "LAW", "2003433", "002", "تقرير مقرر العقود التجارية وعمليات البنوك.docx"),
    ("OneDrive_1_27-9-2026.zip", "LAW", "2003417", None, "تقرير مقرر نظام العمل والتأمينات الاجتماعية - فصل ثان 1447هـ.docx"),
)
EXPECTED_STUDENTS = {("QRA", "2002308"): 12, ("QRA", "2002307"): 12, ("LAW", "2003417"): 145}
FIELDS = ("الحزمة", "مسار_الملف_في_الحزمة", "القسم", "الفصل", "رمز_المقرر", "الشعبة_التنظيمية", "مسار_المصدر_المحفوظ", "مسار_التسليم", "بصمة_SHA256")


def decoded(name: str) -> str:
    try:
        return name.encode("cp437").decode("utf-8")
    except (UnicodeError, UnicodeEncodeError):
        return name


def clean_filename(name: str) -> str:
    return unicodedata.normalize("NFC", "".join(char for char in name if char not in "\u200e\u200f\u2066\u2067\u2068\u2069"))


def write_new(path: Path, contents: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("xb") as handle:
        handle.write(contents)
        handle.flush()
        os.fsync(handle.fileno())
    if hashlib.sha256(path.read_bytes()).digest() != hashlib.sha256(contents).digest():
        raise RuntimeError(f"Written copy differs from ZIP source: {path}")


def main(apply: bool) -> None:
    with REGISTER.open(encoding="utf-8-sig", newline="") as handle:
        register = list(csv.DictReader(handle))
    for (dept, code), count in EXPECTED_STUDENTS.items():
        actual = sum(int(row["عدد_الطلاب"]) for row in register if row["رمز_القسم"] == dept and row["رمز_المقرر"] == code)
        if actual != count:
            raise RuntimeError(f"Registered student count changed for {dept} {code}: {actual}")

    prepared = []
    for zip_name, dept, code, section, filename in SELECTION:
        source_zip = SOURCE_DIR / zip_name
        with ZipFile(source_zip) as archive:
            matches = [(item, decoded(item.filename)) for item in archive.infolist()
                       if not item.is_dir() and decoded(item.filename).rsplit("/", 1)[-1] == filename]
            if len(matches) != 1:
                raise RuntimeError(f"Expected one ZIP entry for {filename}; found {len(matches)}")
            item, source_path = matches[0]
            contents = archive.read(item)
        matches = [row for row in register if row["رمز_القسم"] == dept and row["رمز_المقرر"] == code
                   and (section is None or row["الشعبة_التنظيمية"] == section)]
        if not matches or (section is not None and len(matches) != 1):
            raise RuntimeError(f"No unique register match: {dept} {code} {section}")
        relative = matches[0]["تقرير_المقرر_المجمع" if section is None else "تقرير_الشعبة"]
        safe_name = clean_filename(filename)
        target = TEAM / relative / safe_name
        original = ARCHIVE / dept / "٤٧٢" / safe_name
        if target.exists() or original.exists():
            raise FileExistsError(f"Source archive or target already exists: {original}, {target}")
        if any(path.suffix.lower() in {".docx", ".pdf", ".xlsx", ".xls", ".csv"}
               for path in target.parent.iterdir() if path.is_file()):
            raise RuntimeError(f"Delivery folder is no longer empty: {target.parent}")
        record = dict(zip(FIELDS, (zip_name, source_path, dept, "٤٧٢", code, section or "مجمع",
                                   str(original.relative_to(TEAM)), str(target.relative_to(TEAM)),
                                   hashlib.sha256(contents).hexdigest())))
        prepared.append((original, target, contents, record))

    if AUDIT.exists():
        raise FileExistsError(AUDIT)
    for _, target, _, record in prepared:
        print(f"{record['رمز_المقرر']} {record['الشعبة_التنظيمية']}: {target}")
    if not apply:
        print(f"Dry run: {len(prepared)} matched reports; pass --apply to copy")
        return
    for original, target, contents, _ in prepared:
        write_new(original, contents)
        write_new(target, contents)
    AUDIT.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT.open("x", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(record for *_, record in prepared)
    print(f"Copied {len(prepared)} reports and saved audit: {AUDIT}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    main(parser.parse_args().apply)
