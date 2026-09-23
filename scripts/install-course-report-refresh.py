#!/usr/bin/env python3
"""Install the course-report scan in an app-owned path for hourly launchd runs."""

from __future__ import annotations

import os
import plistlib
import shutil
import subprocess
import sys
from pathlib import Path


LABEL = "edu.taif.sharia.course-report-dashboard-refresh"
REPO = Path(__file__).resolve().parents[1]
SOURCE_SCANNER = REPO / "scripts" / "course-delivery-scanner.py"
INSTALL_DIR = Path.home() / "Library/Application Support/tu-course-reports/dashboard-sync"
PLIST = Path.home() / "Library/LaunchAgents" / f"{LABEL}.plist"
PYTHON = Path.home() / "Library/Application Support/tu-course-reports/venv/bin/python3.14"


def main() -> None:
    if not SOURCE_SCANNER.is_file():
        raise FileNotFoundError(SOURCE_SCANNER)
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    PLIST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(REPO / "scripts/refresh-course-reports.py", INSTALL_DIR / "refresh-course-reports.py")
    shutil.copy2(SOURCE_SCANNER, INSTALL_DIR / "course-delivery-scanner.py")
    python = str(PYTHON if PYTHON.is_file() else Path(sys.executable))
    config = {
        "Label": LABEL,
        "ProgramArguments": [python, str(INSTALL_DIR / "refresh-course-reports.py"), "--sync"],
        "RunAtLoad": True,
        "StartInterval": 3600,
        "EnvironmentVariables": {
            "COURSE_REPORT_SCANNER": str(INSTALL_DIR / "course-delivery-scanner.py"),
            "COURSE_REPORT_OUTPUT": str(INSTALL_DIR / "course-report-public-sheet.csv"),
        },
        "StandardOutPath": str(INSTALL_DIR / "refresh.log"),
        "StandardErrorPath": str(INSTALL_DIR / "refresh-error.log"),
    }
    PLIST.write_bytes(plistlib.dumps(config))
    domain = f"gui/{os.getuid()}"
    subprocess.run(["launchctl", "bootout", f"{domain}/{LABEL}"], check=False, capture_output=True)
    subprocess.run(["launchctl", "bootstrap", domain, str(PLIST)], check=True)
    print(f"Installed hourly refresh: {PLIST}")
    print(f"Read result: {INSTALL_DIR / 'refresh.log'}")


if __name__ == "__main__":
    main()
