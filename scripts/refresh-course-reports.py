#!/usr/bin/env python3
"""Scan the synced SharePoint folder and optionally publish name-free counts to Sheets."""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import subprocess
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
SYNC_SNAPSHOT = TEAM_FOLDER / "2-المتابعة" / "مؤشرات-تقارير-المقررات.json"
TERMS = ("٤٦١", "٤٦٢", "٤٧١", "٤٧٢")
DEPARTMENTS = {
    "SHR": "قسم الشريعة",
    "LAW": "قسم الأنظمة",
    "QRA": "قسم القراءات",
    "ISC": "قسم الثقافة الإسلامية",
}
HEADER = ("الفصل", "القسم", "الشعب", "تقارير الشعب المسلمة",
          "قياسات المخرجات المسلمة", "المقررات", "التقارير المجمعة المسلمة",
          "المجمعة مع نقص تقارير الشعب", "وقت الفحص")


def scan(sync_details: bool = False) -> list[list[str | int]]:
    spec = importlib.util.spec_from_file_location("course_delivery", SCANNER)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {SCANNER}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not TEAM_FOLDER.is_dir():
        raise FileNotFoundError(TEAM_FOLDER)
    rows: list[list[str | int]] = []
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
                     total["التقارير_المجمعة_المسلمة"], total["المجمعة_مع_نقص_تقارير_الشعب"], checked])
        for department in summary["الأقسام"]:
            rows.append([term, DEPARTMENTS[department["القسم"]], department["الشعب"],
                         department["تقارير_الشعب_المسلمة"], department["قياسات_المخرجات_المسلمة"],
                         department["المقررات_التي_يدرسها_القسم"],
                         department["التقارير_المجمعة_المسلمة"],
                         department["المجمعة_مع_نقص_تقارير_الشعب"], checked])
    if len(rows) != 20:
        raise RuntimeError("Expected 20 term/department rows")
    return rows


def write_synced_snapshot(rows: list[list[str | int]]) -> None:
    if subprocess.run(["pgrep", "-x", "OneDrive"], capture_output=True, check=False).returncode != 0:
        raise RuntimeError("OneDrive is not running; refusing to publish a fresh scan timestamp")
    SYNC_SNAPSHOT.parent.mkdir(parents=True, exist_ok=True)
    temporary = SYNC_SNAPSHOT.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    os.replace(temporary, SYNC_SNAPSHOT)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sync", action="store_true", help="Write the aggregate snapshot into the synced SharePoint folder")
    args = parser.parse_args()
    if args.sync and subprocess.run(["pgrep", "-x", "OneDrive"], capture_output=True, check=False).returncode != 0:
        raise RuntimeError("OneDrive is not running; refusing to publish a fresh scan timestamp")
    rows = scan(sync_details=args.sync)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(HEADER)
        writer.writerows(rows)
    if args.sync:
        write_synced_snapshot(rows)
    print(f"Scanned {len(rows)} aggregate rows; saved {OUTPUT}")
    if args.sync:
        print(f"Synced aggregate snapshot: {SYNC_SNAPSHOT}")


if __name__ == "__main__":
    main()
