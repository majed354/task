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
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from zipfile import ZipFile

ACCEPTED = {".docx", ".xlsx", ".xls", ".pdf", ".csv"}
EXCLUSIONS = "استثناءات-تقارير-جزئية-1447.csv"
PARTIAL_DIR = "04-تقارير-الأعضاء-الجزئية"


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
    course_department_folders: dict[tuple[str, str], Path] = {}
    detail_lookup: dict[tuple[str, str, str], dict] = {}
    for row in rows:
        report_files = submitted(root / row["تقرير_الشعبة"], root, omitted)
        clo_files = submitted(root / row["قياس_مخرجات_الشعبة"], root, omitted)
        code = row["رمز_المقرر"]
        course_folders[code] = row["تقرير_المقرر_المجمع"]
        course_departments.setdefault(code, set()).add(row["رمز_القسم"])
        course_department_folders[(row["رمز_القسم"], code)] = Path(row["مسار_الشعبة"].split("/الشعب/")[0])
        detail = {
            "القسم": row["رمز_القسم"], "البرنامج": row["البرنامج"],
            "رمز_المقرر": row["رمز_المقرر"], "اسم_المقرر": row["اسم_المقرر"],
            "الشعبة_التنظيمية": row["الشعبة_التنظيمية"],
            "عضو_هيئة_التدريس": row["عضو_هيئة_التدريس"],
            "رقم_الشعبة_الرسمي": row["رقم_الشعبة_الرسمي"],
            "تقرير_الشعبة": "مسلّم" if report_files else "بانتظار الرفع",
            "قياس_المخرجات": "مسلّم" if clo_files else "بانتظار الرفع",
            "تغطية_بتقرير_جزئي": False,
            "ملفات_التقرير": report_files, "ملفات_القياس": clo_files,
            "مسار_الشعبة": row["مسار_الشعبة"],
        }
        details.append(detail)
        detail_lookup[(row["رمز_القسم"], code, row["الشعبة_التنظيمية"])] = detail
        course_details.setdefault(code, []).append(detail)
    partial_reports = []
    for (dept, code), course_folder in sorted(course_department_folders.items()):
        partial_root = root / course_folder / PARTIAL_DIR
        if not partial_root.is_dir():
            continue
        for group in sorted(partial_root.iterdir()):
            if not group.is_dir():
                continue
            files = submitted(group, root, omitted)
            if not files:
                continue
            match = re.fullmatch(r"(ش\d{3}(?:\+ش\d{3})*)-.+", group.name)
            if match:
                section_ids = re.findall(r"ش(\d{3})", match.group(1))
                if len(section_ids) != len(set(section_ids)):
                    raise ValueError(f"Repeated section in partial-report folder: {group}")
                for section_id in section_ids:
                    key = (dept, code, section_id)
                    if key not in detail_lookup:
                        raise ValueError(f"Unknown section in partial-report folder: {group}")
                    detail_lookup[key]["تغطية_بتقرير_جزئي"] = True
                    detail_lookup[key].setdefault("مجموعات_التقارير_الجزئية", []).append(group.relative_to(root).as_posix())
                status = "شعب معينة"
            elif group.name.startswith("قيد-المطابقة-"):
                section_ids = []
                status = "بانتظار تعيين الشعب"
            else:
                raise ValueError(f"Unclassified partial-report folder: {group}")
            partial_reports.append({
                "القسم": dept, "رمز_المقرر": code, "الحالة": status,
                "الشعب_المغطاة": section_ids, "الملفات": files,
                "المسار": group.relative_to(root).as_posix(),
            })
    combined = []
    public_courses = []
    for course, path in sorted(course_folders.items()):
        local_folders = [folder for (dept, code), folder in course_department_folders.items() if code == course]
        report_candidates = [Path(path)] + [folder / "03-التقرير-المجمع-للمقرر" for folder in local_folders]
        found_reports = [(candidate, submitted(root / candidate, root, omitted)) for candidate in report_candidates]
        found_reports = [(candidate, names) for candidate, names in found_reports if names]
        files = [name for _, names in found_reports for name in names]
        file_path = found_reports[0][0].as_posix() if found_reports else path
        measurement_path = path.replace("00-التقارير-المجمعة-للمقررات", "00-قياسات-المخرجات-المجمعة-للمقررات")
        measurement_candidates = [Path(measurement_path)] + [folder / "05-قياس-مخرجات-المقرر-المجمع" for folder in local_folders]
        found_measurements = [(candidate, submitted(root / candidate, root, omitted)) for candidate in measurement_candidates]
        found_measurements = [(candidate, names) for candidate, names in found_measurements if names]
        measurement_files = [name for _, names in found_measurements for name in names]
        sections = course_details[course]
        # A single-section course needs just its report and CLO file; either course or section folder suffices.
        if len(sections) == 1:
            only = sections[0]
            if files and only["تقرير_الشعبة"] != "مسلّم":
                only["تقرير_الشعبة"] = "مسلّم"
                only["ملفات_التقرير"] = files
                only["مصدر_التقرير"] = "تقرير المقرر المجمع لشعبة واحدة"
            elif only["تقرير_الشعبة"] == "مسلّم" and not files:
                files = only["ملفات_التقرير"]
                file_path = only["مسار_الشعبة"] + "/01-تقرير-المقرر"
            if measurement_files and only["قياس_المخرجات"] != "مسلّم":
                only["قياس_المخرجات"] = "مسلّم"
                only["ملفات_القياس"] = measurement_files
                only["مصدر_القياس"] = "قياس المقرر المجمع لشعبة واحدة"
            elif only["قياس_المخرجات"] == "مسلّم" and not measurement_files:
                measurement_files = only["ملفات_القياس"]
        missing = [d["الشعبة_التنظيمية"] for d in sections
                   if d["تقرير_الشعبة"] != "مسلّم" and not d["تغطية_بتقرير_جزئي"]]
        covered = sum(d["تقرير_الشعبة"] == "مسلّم" or d["تغطية_بتقرير_جزئي"] for d in sections)
        measured = sum(d["قياس_المخرجات"] == "مسلّم" for d in sections)
        required = 2 if len(sections) == 1 else len(sections) * 2 + 2
        completed = (int(bool(files) or bool(covered)) + int(bool(measurement_files)) if len(sections) == 1 else
                     covered + measured + int(bool(files)) + int(bool(measurement_files)))
        combined.append({"الأقسام": sorted(course_departments[course]), "رمز_المقرر": course,
                         "الحالة": "مسلّم" if files else "بانتظار الرفع",
                         "الملفات": files, "المسار": path, "مسار_الملفات": file_path,
                         "قياس_المقرر_المجمع": "مسلّم" if measurement_files else "بانتظار الرفع",
                         "ملفات_القياس_المجمع": measurement_files, "مسار_القياس_المجمع": measurement_path,
                         "عدد_الشعب": len(sections), "الشعب_دون_تقرير": missing,
                         "عدد_المتطلبات": required, "عدد_المنجز": completed,
                         "حالة_التغطية": ("مجمّع مع نقص تقارير الشعب" if files and missing else
                                            "مجمّع وتقارير الشعب مكتملة" if files else "بانتظار التقرير المجمع"),
                         "مصدر_التقرير": "تقرير الشعبة الوحيدة" if file_path != path else "مجلد التقرير المجمع"})
        public_courses.append({
            "الفصل": term, "رمز_المقرر": course, "اسم_المقرر": sections[0]["اسم_المقرر"],
            "الأقسام": sorted(course_departments[course]),
            "عدد_الشعب": len(sections), "عدد_المتطلبات": required, "عدد_المنجز": completed,
            "تقرير_مجمع": bool(files), "قياس_مجمع": bool(measurement_files),
            "تقارير_جزئية_بانتظار_الإسناد": sum(p["رمز_المقرر"] == course and p["الحالة"] == "بانتظار تعيين الشعب" for p in partial_reports),
            "الشعب": [{"القسم": d["القسم"], "الشعبة": d["الشعبة_التنظيمية"],
                       "العضو": d["عضو_هيئة_التدريس"].strip(),
                       "التقرير": ("مستقل" if d["تقرير_الشعبة"] == "مسلّم" else
                                    "تغطية جماعية" if d["تغطية_بتقرير_جزئي"] else "غير مسلّم"),
                       "القياس": d["قياس_المخرجات"] == "مسلّم"} for d in sections],
        })
    stamp = datetime.now(ZoneInfo("Asia/Riyadh")).isoformat(timespec="seconds")
    internal = {"الفصل": term, "وقت_الفحص": stamp, "الشعب": details,
                "التقارير_الجزئية": partial_reports, "التقارير_المجمعة": combined}
    by_dept = []
    for dept in ("SHR", "LAW", "QRA", "ISC"):
        items = [d for d in details if d["القسم"] == dept]
        courses = [c for c in combined if dept in c["الأقسام"]]
        partials = [p for p in partial_reports if p["القسم"] == dept]
        by_dept.append({
            "القسم": dept, "الشعب": len(items),
            "تقارير_الشعب_المسلمة": sum(d["تقرير_الشعبة"] == "مسلّم" for d in items),
            "قياسات_المخرجات_المسلمة": sum(d["قياس_المخرجات"] == "مسلّم" for d in items),
            "المقررات_التي_يدرسها_القسم": len(courses),
            "التقارير_المجمعة_المسلمة": sum(c["الحالة"] == "مسلّم" for c in courses),
            "قياسات_المخرجات_المجمعة_المسلمة": sum(c["قياس_المقرر_المجمع"] == "مسلّم" for c in courses),
            "المجمعة_مع_نقص_تقارير_الشعب": sum(c["الحالة"] == "مسلّم" and bool(c["الشعب_دون_تقرير"]) for c in courses),
            "الشعب_المغطاة_بتقرير_جزئي": sum(d["تغطية_بتقرير_جزئي"] for d in items),
            "التقارير_الجزئية_المسلمة": len(partials),
            "التقارير_الجزئية_بانتظار_تعيين_الشعب": sum(p["الحالة"] == "بانتظار تعيين الشعب" for p in partials),
            "الشعب_ذات_أي_تقرير": sum(d["تقرير_الشعبة"] == "مسلّم" or d["تغطية_بتقرير_جزئي"] for d in items),
        })
    totals = {
        "الشعب": len(details),
        "تقارير_الشعب_المسلمة": sum(d["تقرير_الشعبة"] == "مسلّم" for d in details),
        "قياسات_المخرجات_المسلمة": sum(d["قياس_المخرجات"] == "مسلّم" for d in details),
        "المقررات_الفريدة": len(combined),
        "التقارير_المجمعة_المسلمة": sum(c["الحالة"] == "مسلّم" for c in combined),
        "قياسات_المخرجات_المجمعة_المسلمة": sum(c["قياس_المقرر_المجمع"] == "مسلّم" for c in combined),
        "المجمعة_مع_نقص_تقارير_الشعب": sum(c["الحالة"] == "مسلّم" and bool(c["الشعب_دون_تقرير"]) for c in combined),
        "الشعب_المغطاة_بتقرير_جزئي": sum(d["تغطية_بتقرير_جزئي"] for d in details),
        "التقارير_الجزئية_المسلمة": len(partial_reports),
        "التقارير_الجزئية_بانتظار_تعيين_الشعب": sum(p["الحالة"] == "بانتظار تعيين الشعب" for p in partial_reports),
        "الشعب_ذات_أي_تقرير": sum(d["تقرير_الشعبة"] == "مسلّم" or d["تغطية_بتقرير_جزئي"] for d in details),
    }
    public = {"الفصل": term, "وقت_الفحص": stamp,
              "تعريف_الشعبة": "رقم تنظيمي تسلسلي، وليس الرقم الرسمي",
              "تعريف_التقرير_المجمع": "تقرير واحد لكل رمز مقرر؛ وتقرير المقرر ذي الشعبة الواحدة يفي بالتقريرين",
              "تعريف_التقرير_الجزئي": "تقرير أستاذ أو مجموعة شعب؛ يثبت تغطية الشعب المعيّنة فقط ولا يحوّل المقرر إلى تقرير مجمع كامل",
              "الأقسام": by_dept,
              "الإجمالي": totals, "المقررات": public_courses}
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
