#!/usr/bin/env python3
"""يفحص تسليم تقرير الشعبة وقياس CLO والتقرير المجمع لكل فصل متاح.

يقرأ الملفات الموجودة فعلاً في مجلد الفريق المتزامن. تعليمات اقرأني.md
لا تُحسب تسليمًا. يخرج سجلًا داخليًا بالأسماء وملخصًا مجمعًا بلا أسماء.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from zipfile import ZipFile

ACCEPTED = {".docx", ".xlsx", ".xls", ".pdf", ".csv"}
EXCLUSIONS = "استثناءات-تقارير-جزئية-1447.csv"


def content_digest(path: Path) -> str:
    """Ignore SharePoint's added Office metadata when identifying an old partial report."""
    if path.suffix.lower() == ".docx":
        try:
            with ZipFile(path) as office:
                return hashlib.sha256(office.read("word/document.xml")).hexdigest()
        except (KeyError, ValueError):
            pass
    return hashlib.sha256(path.read_bytes()).hexdigest()


def exclusions(root: Path) -> dict[str, str]:
    path = root / "0-الأدلة-والقوالب" / "قوائم-المقررات" / EXCLUSIONS
    if not path.is_file():
        return {}
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return {row["المسار"]: row["بصمة_المحتوى"] for row in csv.DictReader(handle)}


def submitted(folder: Path, root: Path, omitted: dict[str, str]) -> list[str]:
    if not folder.is_dir():
        return []
    files = []
    for path in folder.iterdir():
        if not path.is_file() or path.suffix.lower() not in ACCEPTED or path.name.startswith("~$"):
            continue
        relative = path.relative_to(root).as_posix()
        if relative in omitted and content_digest(path) == omitted[relative]:
            continue
        files.append(path.name)
    return files


def inspect(root: Path, term: str = "٤٧٢") -> tuple[dict, dict]:
    register = root / "0-الأدلة-والقوالب" / "قوائم-المقررات" / f"سجل-الشعب-{term}.csv"
    with register.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    omitted = exclusions(root)
    details = []
    course_folders: dict[str, str] = {}
    course_departments: dict[str, set[str]] = {}
    course_details: dict[str, list[dict]] = {}
    for row in rows:
        report_files = submitted(root / row["تقرير_الشعبة"], root, omitted)
        clo_files = submitted(root / row["قياس_مخرجات_الشعبة"], root, omitted)
        code = row["رمز_المقرر"]
        course_folders[code] = row["تقرير_المقرر_المجمع"]
        course_departments.setdefault(code, set()).add(row["رمز_القسم"])
        detail = {
            "القسم": row["رمز_القسم"], "البرنامج": row["البرنامج"],
            "رمز_المقرر": row["رمز_المقرر"], "اسم_المقرر": row["اسم_المقرر"],
            "الشعبة_التنظيمية": row["الشعبة_التنظيمية"],
            "عضو_هيئة_التدريس": row["عضو_هيئة_التدريس"],
            "رقم_الشعبة_الرسمي": row["رقم_الشعبة_الرسمي"],
            "تقرير_الشعبة": "مسلّم" if report_files else "بانتظار الرفع",
            "قياس_المخرجات": "مسلّم" if clo_files else "بانتظار الرفع",
            "ملفات_التقرير": report_files, "ملفات_القياس": clo_files,
            "مسار_الشعبة": row["مسار_الشعبة"],
        }
        details.append(detail)
        course_details.setdefault(code, []).append(detail)
    combined = []
    for course, path in sorted(course_folders.items()):
        files = submitted(root / path, root, omitted)
        file_path = path
        sections = course_details[course]
        # One report satisfies both obligations when the course has one section.
        if len(sections) == 1:
            only = sections[0]
            if files and only["تقرير_الشعبة"] != "مسلّم":
                only["تقرير_الشعبة"] = "مسلّم"
                only["ملفات_التقرير"] = files
                only["مصدر_التقرير"] = "تقرير المقرر المجمع لشعبة واحدة"
            elif only["تقرير_الشعبة"] == "مسلّم" and not files:
                files = only["ملفات_التقرير"]
                file_path = only["مسار_الشعبة"] + "/01-تقرير-المقرر"
        missing = [d["الشعبة_التنظيمية"] for d in sections if d["تقرير_الشعبة"] != "مسلّم"]
        combined.append({"الأقسام": sorted(course_departments[course]), "رمز_المقرر": course,
                         "الحالة": "مسلّم" if files else "بانتظار الرفع",
                         "الملفات": files, "المسار": path, "مسار_الملفات": file_path,
                         "عدد_الشعب": len(sections), "الشعب_دون_تقرير": missing,
                         "حالة_التغطية": ("مجمّع مع نقص تقارير الشعب" if files and missing else
                                            "مجمّع وتقارير الشعب مكتملة" if files else "بانتظار التقرير المجمع"),
                         "مصدر_التقرير": "تقرير الشعبة الوحيدة" if file_path != path else "مجلد التقرير المجمع"})
    stamp = datetime.now(ZoneInfo("Asia/Riyadh")).isoformat(timespec="seconds")
    internal = {"الفصل": term, "وقت_الفحص": stamp, "الشعب": details, "التقارير_المجمعة": combined}
    by_dept = []
    for dept in ("SHR", "LAW", "QRA", "ISC"):
        items = [d for d in details if d["القسم"] == dept]
        courses = [c for c in combined if dept in c["الأقسام"]]
        by_dept.append({
            "القسم": dept, "الشعب": len(items),
            "تقارير_الشعب_المسلمة": sum(d["تقرير_الشعبة"] == "مسلّم" for d in items),
            "قياسات_المخرجات_المسلمة": sum(d["قياس_المخرجات"] == "مسلّم" for d in items),
            "المقررات_التي_يدرسها_القسم": len(courses),
            "التقارير_المجمعة_المسلمة": sum(c["الحالة"] == "مسلّم" for c in courses),
            "المجمعة_مع_نقص_تقارير_الشعب": sum(c["الحالة"] == "مسلّم" and bool(c["الشعب_دون_تقرير"]) for c in courses),
        })
    totals = {
        "الشعب": len(details),
        "تقارير_الشعب_المسلمة": sum(d["تقرير_الشعبة"] == "مسلّم" for d in details),
        "قياسات_المخرجات_المسلمة": sum(d["قياس_المخرجات"] == "مسلّم" for d in details),
        "المقررات_الفريدة": len(combined),
        "التقارير_المجمعة_المسلمة": sum(c["الحالة"] == "مسلّم" for c in combined),
        "المجمعة_مع_نقص_تقارير_الشعب": sum(c["الحالة"] == "مسلّم" and bool(c["الشعب_دون_تقرير"]) for c in combined),
    }
    public = {"الفصل": term, "وقت_الفحص": stamp,
              "تعريف_الشعبة": "رقم تنظيمي تسلسلي، وليس الرقم الرسمي",
              "تعريف_التقرير_المجمع": "تقرير واحد لكل رمز مقرر؛ وتقرير المقرر ذي الشعبة الواحدة يفي بالتقريرين",
              "الأقسام": by_dept,
              "الإجمالي": totals}
    return internal, public


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--جذر", required=True, type=Path)
    parser.add_argument("--فصل", choices=("٤٦١", "٤٦٢", "٤٧١", "٤٧٢"), default="٤٧٢")
    parser.add_argument("--خرج-عام", type=Path)
    args = parser.parse_args()
    internal, public = inspect(args.جذر, args.فصل)
    dest = args.جذر / "2-المتابعة" / args.فصل / "حالة-التسليم-داخلية.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(internal, ensure_ascii=False, indent=2), encoding="utf-8")
    if args.خرج_عام:
        args.خرج_عام.parent.mkdir(parents=True, exist_ok=True)
        args.خرج_عام.write_text(json.dumps(public, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(public, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
