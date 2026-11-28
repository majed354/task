import unittest
import tempfile
from pathlib import Path
from build_official_sections import match_sections, extract_sources


def register(section, count=20, **extra):
    return {'term': '472', 'code': '2003433', 'member': 'عائشه جبريل مكي علي', 'campus': 'طالبات', 'department': 'قسم الأنظمة', 'section': section, 'students': count, 'signature': 'fixture', 'previous': '', **extra}


def result(number, count=20, **extra):
    return {'term': '472', 'code': '2003433', 'members': ['عائشه جبريل مكي علي'], 'campus': 'طالبات', 'section': number, 'students': count, 'evidence': [{'file': '472.xls', 'row': 5, 'sha256': 'fixture'}], **extra}


class OfficialSectionTests(unittest.TestCase):
    def test_unique_and_count_matching_ignore_source_order(self):
        rows = [register('001', 22), register('002', 83)]
        results = [result('2183', 83), result('2218', 22)]
        matches = match_sections(rows, results)
        self.assertEqual([entry['officialSection'] for entry in matches], ['2218', '2183'])
        self.assertEqual([entry['section'] for entry in matches], ['001', '002'])
        self.assertEqual(rows[0]['previous'], '')

    def test_equal_counts_never_assign_by_order(self):
        matches = match_sections([register('001'), register('002')], [result('99'), result('100')])
        self.assertTrue(all(entry['status'] == 'ambiguous' and not entry['officialSection'] for entry in matches))

    def test_scope_and_member_and_term_are_required(self):
        for wrong in [result('99', term='471'), result('99', code='2003434'), result('99', campus='طلاب'), result('99', members=['عضو آخر'])]:
            self.assertEqual(match_sections([register('001')], [wrong])[0]['status'], 'missing')

    def test_colliding_names_or_official_numbers_remain_unassigned(self):
        rows = [register('001'), register('002', member='عائشة جبريل مكي علي')]
        self.assertTrue(all(not entry['officialSection'] for entry in match_sections(rows, [result('99'), result('100')])))
        rows = [register('001'), register('001', department='قسم آخر')]
        self.assertTrue(all(not entry['officialSection'] for entry in match_sections(rows, [result('99')])))

    def test_previous_conflict_and_remaining_unique(self):
        self.assertEqual(match_sections([register('001', previous='12')], [result('99')])[0]['status'], 'ambiguous')
        matches = match_sections([register('001', 10), register('002', 20)], [result('99', 10), result('100', 19)])
        self.assertEqual(matches[1]['officialSection'], '100')
        self.assertEqual(matches[1]['basis'], 'remaining-unique')

    def test_preexisting_number_can_verify_an_abbreviated_name_only_at_that_number(self):
        row = register('001', previous='2681', member='د. مريم سعد الرشيدي')
        raw = result('2681', members=['مريم سعد عيد الذيابي الرشيدي'])
        self.assertEqual(match_sections([row], [raw])[0]['officialSection'], '2681')
        self.assertEqual(match_sections([{**row, 'previous': ''}], [raw])[0]['status'], 'missing')
        self.assertEqual(match_sections([{**row, 'member': 'عضو آخر مختلف'}], [raw])[0]['status'], 'missing')

    def test_raw_header_period_and_deduplicated_enrolments(self):
        html = '''<!DOCTYPE HTML><html><meta charset="utf-8"><table>
        <tr><td>للفصل الدراسي الفصل الثاني 1447</td></tr>
        <tr><td>مقر:</td><td>حوية طالبات</td><td>شعبة:</td><td>٤٣٦٧</td></tr>
        <tr><td>المقرر:</td><td>2003433-2</td><td>العقود</td><td>المدرس:</td><td>عائشه جبريل مكي علي</td></tr>
        <tr><td>1</td><td>111111111</td><td>طالب تجريبي</td><td>غير مرصود</td></tr>
        <tr><td>1</td><td>111111111</td><td>طالب تجريبي</td><td>غير مرصود</td></tr>
        </table></html>'''
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)
            (path / 'misleading-461.xls').write_text(html)
            (path / 'copy.xls').write_text(html)
            entries, sources = extract_sources(path)
        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0]['section'], '4367')
        self.assertEqual(entries[0]['term'], '472')
        self.assertEqual(entries[0]['students'], 1)
        self.assertEqual(sum(source['duplicate'] for source in sources), 1)
        self.assertNotIn('111111111', str(entries))


if __name__ == '__main__':
    unittest.main()
