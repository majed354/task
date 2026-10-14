#!/usr/bin/env python3
"""Relay the live SharePoint list snapshot to the department-protected portal."""
from __future__ import annotations

import argparse
import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TEAM = Path('/Users/majd/Library/CloudStorage/OneDrive-TaifUniversity/كلية الشريعة والأنظمة — الجودة والاعتماد - متابعة تقارير المقررات')
SOURCE = Path(os.environ.get('COMMITTEE_SNAPSHOT_FILE', TEAM / '2-المتابعة/مهام-اللجان.json'))
KEY = Path(os.environ.get('COURSE_REPORT_INGEST_KEY_FILE', Path.home() / 'Library/Application Support/tu-course-reports/dashboard-sync/course-ingest-key'))
URL = os.environ.get('COMMITTEE_INGEST_URL', 'https://shari3ahtask.netlify.app/api/course/committee-ingest')

def refresh() -> int:
    value = json.loads(SOURCE.read_text(encoding='utf-8-sig'))
    if not isinstance(value, dict) or not isinstance(value.get('items'), list) or len(value['items']) < 340:
        raise ValueError('Incomplete live SharePoint committee snapshot')
    checked = datetime.fromisoformat(re.sub(r'(\.\d{6})\d+', r'\1', value.get('checkedAt', '')).replace('Z', '+00:00'))
    if checked.tzinfo is None or (checked - datetime.now(timezone.utc)).total_seconds() > 300:
        raise ValueError('Invalid SharePoint snapshot timestamp')
    key = KEY.read_text(encoding='utf-8').strip()
    if len(key) < 32:
        raise ValueError('Missing portal ingest key')
    payload = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    request = urllib.request.Request(URL, data=payload, method='POST', headers={'Content-Type': 'application/json', 'X-Course-Ingest-Key': key})
    with urllib.request.urlopen(request, timeout=30) as response:
        result = json.load(response)
    if result.get('ok') is not True or result.get('tasks') != len(value['items']):
        raise RuntimeError('Protected dashboard rejected the committee snapshot')
    print(f"Updated protected committee dashboard: {result['tasks']} tasks; source time {value['checkedAt']}")
    return result['tasks']

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.parse_args()
    refresh()
