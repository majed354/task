#!/usr/bin/env python3
"""Scan SharePoint, sync the private Google source, and update the protected dashboard."""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import subprocess
import unicodedata
import urllib.request
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


def write_synced_snapshot(rows: list[list[str | int]], detail_rows: list[list[str | int]]) -> bytes:
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
    payload = json.dumps({"aggregateRows": rows, "courseRows": detail_rows}, ensure_ascii=False,
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
        payload = write_synced_snapshot(rows, detail_rows)
        upload_protected_snapshot(payload, len(detail_rows))
    print(f"Scanned {len(rows)} aggregate rows and {len(detail_rows)} section rows; saved {OUTPUT} and {DETAIL_OUTPUT}")
    if args.sync:
        print(f"Synced aggregate snapshot: {SYNC_SNAPSHOT}")
        print(f"Updated protected dashboard: {len(detail_rows)} sections")


if __name__ == "__main__":
    main()
