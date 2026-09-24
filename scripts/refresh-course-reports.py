#!/usr/bin/env python3
"""Scan SharePoint, sync the private Google source, and update the protected dashboard."""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import re
import subprocess
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCANNER = Path(os.environ.get(
    "COURSE_REPORT_SCANNER",
    Path(__file__).resolve().parent / "course-delivery-scanner.py",
))
TEAM_FOLDER = Path(
    "/Users/majd/Library/CloudStorage/OneDrive-TaifUniversity/"
    "كلية الشريعة والأنظمة — الجودة والاعتماد - متابعة تقارير المقررات"
)
OUTPUT = Path(os.environ.get(
    "COURSE_REPORT_OUTPUT",
    ROOT / "outputs" / "course-report-public-sheet.csv",
))
DETAIL_OUTPUT = Path(os.environ.get(
    "COURSE_REPORT_DETAIL_OUTPUT",
    ROOT / "outputs" / "course-report-detail-public-sheet.csv",
))
SYNC_SNAPSHOT = TEAM_FOLDER / "2-المتابعة" / "مؤشرات-تقارير-المقررات.json"
INGEST_URL = os.environ.get("COURSE_REPORT_INGEST_URL", "https://shari3ahtask.netlify.app/api/course/ingest")
INGEST_KEY_FILE = Path(os.environ.get(
    "COURSE_REPORT_INGEST_KEY_FILE",
    Path.home() / "Library/Application Support/tu-course-reports/dashboard-sync/course-ingest-key",
))
TERMS = ("٤٦١", "٤٦٢", "٤٧١", "٤٧٢")
DEPARTMENTS = {
    "SHR": "قسم الشريعة",
    "LAW": "قسم الأنظمة",
    "QRA": "قسم القراءات",
    "ISC": "قسم الثقافة الإسلامية",
}
HEADER = ("الفصل", "القسم", "الشعب", "تقارير الشعب المسلمة",
          "قياسات المخرجات المسلمة", "المقررات", "التقارير المجمعة المسلمة",
          "المجمعة مع نقص تقارير الشعب", "وقت الفحص",
          "الشعب المغطاة بتقرير جزئي", "التقارير الجزئية المسلمة",
          "تقارير جزئية بانتظار الإسناد", "الشعب ذات أي تقرير",
          "قياسات المخرجات المجمعة المسلمة")
DETAIL_HEADER = ("الفصل", "رمز المقرر", "اسم المقرر", "القسم", "الشعبة التنظيمية",
                 "حالة تقرير الشعبة", "قياس مخرجات الشعبة", "التقرير المجمع",
                 "القياس المجمع", "المتطلبات المنجزة", "إجمالي المتطلبات",
                 "تقارير جزئية بانتظار الإسناد", "وقت الفحص", "عضو هيئة التدريس")
THESIS_HEADER = ("الفصل", "رمز_القسم", "رمز_المقرر", "الشعبة_التنظيمية", "معرف_العضو",
                 "عضو_هيئة_التدريس", "معرف_الرسالة", "تاريخ_رصد_الدرجة")
THESIS_REGISTRY = TEAM_FOLDER / "0-الأدلة-والقوالب" / "قوائم-المقررات" / "سجل-حالات-الرسائل.csv"


def thesis_key(row: dict[str, str]) -> tuple[str, str, str, str]:
    return tuple(row[field].strip() for field in THESIS_HEADER[:4])


def thesis_register() -> tuple[list[dict[str, str]], bool]:
    """Merge new thesis sections without replacing manually recorded grades or IDs."""
    if THESIS_REGISTRY.exists():
        with THESIS_REGISTRY.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            if reader.fieldnames != list(THESIS_HEADER):
                raise ValueError("Thesis status register columns have changed")
            existing = list(reader)
    else:
        existing = []
    by_key: dict[tuple[str, str, str, str], dict[str, str]] = {}
    for row in existing:
        key = thesis_key(row)
        if key in by_key:
            raise ValueError(f"Repeated thesis status row: {key}")
        grade = row["تاريخ_رصد_الدرجة"].strip()
        if grade:
            try:
                recorded = date.fromisoformat(grade) if re.fullmatch(r"\d{4}-\d{2}-\d{2}", grade) else None
                if recorded is None or recorded > date.today():
                    raise ValueError(grade)
            except ValueError as error:
                raise ValueError(f"Invalid thesis grade date: {key}") from error
        by_key[key] = row
    changed = not THESIS_REGISTRY.exists()
    for term in TERMS:
        source = THESIS_REGISTRY.parent / f"سجل-الشعب-{term}.csv"
        with source.open(encoding="utf-8-sig", newline="") as handle:
            for section in csv.DictReader(handle):
                if section["اسم_المقرر"].strip() != "الرسالة":
                    continue
                row = {"الفصل": term, "رمز_القسم": section["رمز_القسم"],
                       "رمز_المقرر": section["رمز_المقرر"],
                       "الشعبة_التنظيمية": section["الشعبة_التنظيمية"],
                       "معرف_العضو": section["معرف_العضو"],
                       "عضو_هيئة_التدريس": section["عضو_هيئة_التدريس"],
                       "معرف_الرسالة": "", "تاريخ_رصد_الدرجة": ""}
                key = thesis_key(row)
                if key not in by_key:
                    by_key[key] = row
                    changed = True
                elif any(by_key[key][field].strip() != row[field].strip() for field in THESIS_HEADER[4:6]):
                    raise ValueError(f"Thesis section assignment changed; review manually: {key}")
    rows = [by_key[key] for key in sorted(by_key, key=lambda key: (TERMS.index(key[0]), key[1], key[2], key[3]))]
    return rows, changed


def write_thesis_register(rows: list[dict[str, str]]) -> None:
    THESIS_REGISTRY.parent.mkdir(parents=True, exist_ok=True)
    with THESIS_REGISTRY.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=THESIS_HEADER)
        writer.writeheader()
        writer.writerows(rows)


def thesis_snapshot(rows: list[dict[str, str]], details: list[list[str | int]]) -> tuple[list[dict], list[dict]]:
    thesis_details = {(str(row[0]), str(row[1]), str(row[3]), str(row[4])): row for row in details if row[2] == "الرسالة"}
    recorded = {key: row for row in rows if (key := (row["الفصل"], row["رمز_المقرر"], DEPARTMENTS[row["رمز_القسم"]], row["الشعبة_التنظيمية"])) in thesis_details}
    if len(recorded) != len(thesis_details):
        raise ValueError("Thesis status register does not cover every thesis section")
    matched_rows = list(recorded.values())
    by_study: dict[tuple[str, str, str], set[str]] = {}
    by_member: dict[tuple[str, str, str], set[str]] = {}
    for row in matched_rows:
        study = row["معرف_الرسالة"].strip()
        if study:
            by_study.setdefault((row["رمز_القسم"], row["رمز_المقرر"], study), set()).add(row["الفصل"])
        member_key = (row["رمز_القسم"], row["معرف_العضو"], row["رمز_المقرر"])
        by_member.setdefault(member_key, set()).add(row["الفصل"])
    entries = []
    for key, row in recorded.items():
        detail = thesis_details[key]
        study = row["معرف_الرسالة"].strip()
        member_key = (row["رمز_القسم"], row["معرف_العضو"], row["رمز_المقرر"])
        entries.append({"term": key[0], "code": key[1], "department": key[2], "section": key[3],
                        "member": str(detail[13]), "gradeDate": row["تاريخ_رصد_الدرجة"].strip(),
                        "observedTerms": len(by_study[(row["رمز_القسم"], row["رمز_المقرر"], study)]) if study else len(by_member[member_key]),
                        "basis": "study" if study else "member"})
    signals = []
    for (department, member_id, code), observed in sorted(by_member.items()):
        sequence = [term for term in TERMS if term in observed]
        last = sequence[-1]
        next_term = TERMS[TERMS.index(last) + 1] if last != TERMS[-1] else ""
        matching = [row for row in matched_rows if (row["رمز_القسم"], row["معرف_العضو"], row["رمز_المقرر"]) == (department, member_id, code)]
        signals.append({"department": DEPARTMENTS[department], "code": code,
                        "member": matching[0]["عضو_هيئة_التدريس"], "terms": sequence,
                        "lastTerm": last, "absentNextTerm": next_term,
                        "sections": sum(row["الفصل"] == last for row in matching)})
    return entries, signals


def scan(sync_details: bool = False) -> tuple[list[list[str | int]], list[list[str | int]]]:
    spec = importlib.util.spec_from_file_location("course_delivery", SCANNER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {SCANNER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not TEAM_FOLDER.is_dir():
        raise FileNotFoundError(TEAM_FOLDER)
    rows: list[list[str | int]] = []
    detail_rows: list[list[str | int]] = []
    for term in TERMS:
        internal, summary = module.inspect(TEAM_FOLDER, term)
        if sync_details:
            detail_path = TEAM_FOLDER / "2-المتابعة" / term / "حالة-التسليم-داخلية.json"
            detail_path.parent.mkdir(parents=True, exist_ok=True)
            detail_path.write_text(json.dumps(internal, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        total = summary["الإجمالي"]
        checked = summary["وقت_الفحص"]
        rows.append([term, "كل الأقسام", total["الشعب"], total["تقارير_الشعب_المسلمة"],
                     total["قياسات_المخرجات_المسلمة"], total["المقررات_الفريدة"],
                     total["التقارير_المجمعة_المسلمة"], total["المجمعة_مع_نقص_تقارير_الشعب"], checked,
                     total["الشعب_المغطاة_بتقرير_جزئي"], total["التقارير_الجزئية_المسلمة"],
                     total["التقارير_الجزئية_بانتظار_تعيين_الشعب"], total["الشعب_ذات_أي_تقرير"],
                     total["قياسات_المخرجات_المجمعة_المسلمة"]])
        for department in summary["الأقسام"]:
            rows.append([term, DEPARTMENTS[department["القسم"]], department["الشعب"],
                         department["تقارير_الشعب_المسلمة"], department["قياسات_المخرجات_المسلمة"],
                         department["المقررات_التي_يدرسها_القسم"],
                         department["التقارير_المجمعة_المسلمة"],
                         department["المجمعة_مع_نقص_تقارير_الشعب"], checked,
                         department["الشعب_المغطاة_بتقرير_جزئي"], department["التقارير_الجزئية_المسلمة"],
                         department["التقارير_الجزئية_بانتظار_تعيين_الشعب"], department["الشعب_ذات_أي_تقرير"],
                         department["قياسات_المخرجات_المجمعة_المسلمة"]])
        for course in summary["المقررات"]:
            for section in course["الشعب"]:
                detail_rows.append([term, course["رمز_المقرر"], course["اسم_المقرر"],
                                    DEPARTMENTS[section["القسم"]], section["الشعبة"], section["التقرير"],
                                    int(section["القياس"]), int(course["تقرير_مجمع"]), int(course["قياس_مجمع"]),
                                    course["عدد_المنجز"], course["عدد_المتطلبات"],
                                    course["تقارير_جزئية_بانتظار_الإسناد"], checked, section["العضو"]])
    if len(rows) != 20:
        raise RuntimeError("Expected 20 term/department rows")
    return rows, detail_rows


def write_synced_snapshot(rows: list[list[str | int]], detail_rows: list[list[str | int]], thesis_rows: list[dict], thesis_signals: list[dict]) -> bytes:
    if subprocess.run(["pgrep", "-x", "OneDrive"], capture_output=True, check=False).returncode != 0:
        raise RuntimeError("OneDrive is not running; refusing to publish a fresh scan timestamp")
    SYNC_SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    # A cloud-side replacement can leave a local conflict copy. Stop instead of
    # silently refreshing that copy while the flow reads the older original.
    expected_name = unicodedata.normalize('NFC', SYNC_SNAPSHOT.name)
    conflicts = [path for path in SYNC_SNAPSHOT.parent.glob('*تقارير-المقررات*.json')
                 if unicodedata.normalize('NFC', path.name) != expected_name]
    if conflicts:
        raise RuntimeError(f'OneDrive conflict copy requires reconciliation: {conflicts[0]}')
    payload = json.dumps({"aggregateRows": rows, "courseRows": detail_rows,
                          "thesisRows": thesis_rows, "thesisSignals": thesis_signals}, ensure_ascii=False,
                         separators=(",", ":")) + "\n"
    # Update the existing File Provider item in place. Replacing its inode can leave
    # OneDrive showing the old SharePoint version even though the local path is fresh.
    with SYNC_SNAPSHOT.open("w", encoding="utf-8") as handle:
        handle.write(payload)
        handle.flush()
        os.fsync(handle.fileno())
    return payload.encode("utf-8")


def upload_protected_snapshot(payload: bytes, expected_sections: int) -> None:
    key = INGEST_KEY_FILE.read_text(encoding="utf-8").strip()
    if len(key) < 32:
        raise RuntimeError("Dashboard ingest key is missing or too short")
    request = urllib.request.Request(
        INGEST_URL, data=payload, method="POST",
        headers={"Content-Type": "application/json", "X-Course-Ingest-Key": key},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if result.get("ok") is not True or result.get("sections") != expected_sections:
        raise RuntimeError("Protected dashboard rejected the course-report snapshot")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sync", action="store_true", help="Write the aggregate snapshot into the synced SharePoint folder")
    args = parser.parse_args()
    if args.sync and subprocess.run(["pgrep", "-x", "OneDrive"], capture_output=True, check=False).returncode != 0:
        raise RuntimeError("OneDrive is not running; refusing to publish a fresh scan timestamp")
    rows, detail_rows = scan(sync_details=args.sync)
    register, changed = thesis_register()
    thesis_rows, thesis_signals = thesis_snapshot(register, detail_rows)
    if changed and args.sync:
        write_thesis_register(register)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADER)
        writer.writerows(rows)
    DETAIL_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with DETAIL_OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(DETAIL_HEADER)
        writer.writerows(detail_rows)
    if args.sync:
        payload = write_synced_snapshot(rows, detail_rows, thesis_rows, thesis_signals)
        upload_protected_snapshot(payload, len(detail_rows))
    print(f"Scanned {len(rows)} aggregate rows and {len(detail_rows)} section rows; saved {OUTPUT} and {DETAIL_OUTPUT}")
    if args.sync:
        print(f"Synced aggregate snapshot: {SYNC_SNAPSHOT}")
        print(f"Updated protected dashboard: {len(detail_rows)} sections")


if __name__ == "__main__":
    main()
