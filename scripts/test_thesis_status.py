import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location('refresh', Path(__file__).with_name('refresh-course-reports.py'))
refresh = importlib.util.module_from_spec(spec)
spec.loader.exec_module(refresh)


class ThesisStatusTest(unittest.TestCase):
    def test_grade_is_due_only_in_recorded_term_and_absence_is_review_signal(self):
        with tempfile.TemporaryDirectory() as folder:
            parent = Path(folder)
            registry = parent / 'سجل-حالات-الرسائل.csv'
            source_fields = ['اسم_المقرر', 'رمز_القسم', 'رمز_المقرر', 'الشعبة_التنظيمية', 'معرف_العضو', 'عضو_هيئة_التدريس']
            with patch.object(refresh, 'THESIS_REGISTRY', registry):
                for term in refresh.TERMS:
                    with (parent / f'سجل-الشعب-{term}.csv').open('w', encoding='utf-8-sig', newline='') as handle:
                        writer = csv.DictWriter(handle, fieldnames=source_fields)
                        writer.writeheader()
                        if term != '٤٧٢':
                            writer.writerow({'اسم_المقرر': 'الرسالة', 'رمز_القسم': 'SHR', 'رمز_المقرر': '2001904',
                                             'الشعبة_التنظيمية': '001', 'معرف_العضو': 'A1', 'عضو_هيئة_التدريس': 'عضو أول'})
                rows, changed = refresh.thesis_register()
                self.assertTrue(changed)
                self.assertEqual(len(rows), 3)
                for row in rows:
                    row['معرف_الرسالة'] = 'THESIS-1'
                rows[-1]['تاريخ_رصد_الدرجة'] = '2026-06-01'
                refresh.write_thesis_register(rows)
                preserved, changed = refresh.thesis_register()
                self.assertFalse(changed)
                self.assertEqual(preserved[-1]['تاريخ_رصد_الدرجة'], '2026-06-01')
                details = [[term, '2001904', 'الرسالة', 'قسم الشريعة', '001', 'غير مسلّم', 0, 0, 0, 0, 8, 0, '2026-09-24T12:00:00+03:00', 'عضو أول'] for term in refresh.TERMS[:3]]
                entries, signals = refresh.thesis_snapshot(preserved, details)
                self.assertEqual([entry['gradeDate'] for entry in entries], ['', '', '2026-06-01'])
                self.assertEqual([entry['observedTerms'] for entry in entries], [3, 3, 3])
                self.assertEqual(signals[0]['absentNextTerm'], '٤٧٢')


if __name__ == '__main__':
    unittest.main()
