#!/usr/bin/env python3
import importlib.util
import io
import json
import tempfile
import unittest
import urllib.error
import zipfile
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('reviewer', Path(__file__).with_name('review-committee-submissions.py'))
reviewer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reviewer)

class ReviewValidation(unittest.TestCase):
    def setUp(self):
        self.criteria = [{'id': 'C01', 'requirement': 'دليل التنفيذ'}]
        self.documents = {'شاهد.txt': {'lines': {'سطر 1': 'نُفذ اللقاء في ٢٣ نوفمبر، وحضر ١٢ عضوًا.'}, 'limitations': []}}
        self.result = {'summary': 'مراجعة', 'criteria': [{'id': 'C01', 'status': 'مستوفى', 'comment': 'يوجد شاهد', 'evidence': [{'file': 'شاهد.txt', 'locator': 'سطر 1', 'quote': 'وحضر ١٢ عضوًا'}]}], 'recommendations': [], 'limitations': []}

    def test_real_quote_required(self):
        self.assertEqual(reviewer.validate_result(self.result, self.criteria, self.documents), 'مستوفٍ مبدئيًا')
        self.result['criteria'][0]['evidence'][0]['quote'] = 'وحضر ١٠٠ عضو'
        with self.assertRaises(ValueError):
            reviewer.validate_result(self.result, self.criteria, self.documents)

    def test_missing_and_duplicate_criteria_fail(self):
        self.result['criteria'] *= 2
        with self.assertRaises(ValueError):
            reviewer.validate_result(self.result, self.criteria, self.documents)
        self.result['criteria'] = []
        with self.assertRaises(ValueError):
            reviewer.validate_result(self.result, self.criteria, self.documents)

    def test_unreadable_evidence_blocks_success(self):
        self.result['limitations'] = ['صورة لم تتم قراءتها']
        self.assertEqual(reviewer.validate_result(self.result, self.criteria, self.documents), 'تعذر التحقق')
        self.result['criteria'][0]['status'] = 'ناقص'
        self.assertEqual(reviewer.validate_result(self.result, self.criteria, self.documents), 'يحتاج استكمالًا')

    def test_empty_template_is_not_evidence(self):
        self.documents['شاهد.txt']['lines']['سطر 1'] = '[الاسم]'
        self.result['criteria'][0]['evidence'][0]['quote'] = '[الاسم]'
        with self.assertRaises(ValueError):
            reviewer.validate_result(self.result, self.criteria, self.documents)

    def test_docx_paragraph_locations(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / 'test.docx'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>تنفيذ</w:t></w:r></w:p><w:p><w:r><w:t>نتيجة موثقة</w:t></w:r></w:p></w:body></w:document>')
            lines, limits = reviewer.extract(path)
            self.assertEqual(lines, {'فقرة 1': 'تنفيذ', 'فقرة 2': 'نتيجة موثقة'})
            self.assertEqual(limits, [])

    def test_approval_requires_verified_evidence_and_nonempty_criteria(self):
        verdict = reviewer.validate_result(self.result, self.criteria, self.documents)
        self.assertEqual(reviewer.document_decision(verdict)['status'], 'approved')
        self.result['limitations'] = ['تعذر التحقق من التوقيع']
        verdict = reviewer.validate_result(self.result, self.criteria, self.documents)
        self.assertEqual(reviewer.document_decision(verdict)['status'], 'unverified')
        with self.assertRaises(ValueError):
            reviewer.validate_result({**self.result, 'criteria': []}, [], self.documents)

    def test_deficiency_report_lists_every_unresolved_requirement(self):
        self.criteria.append({'id': 'C02', 'requirement': 'اعتماد الجهة المختصة'})
        self.result['criteria'] = [
            {'id': 'C01', 'status': 'ناقص', 'comment': 'أرفق دليل التنفيذ <test>', 'evidence': []},
            {'id': 'C02', 'status': 'غير متحقق', 'comment': 'أرفق اعتمادًا مقروءًا', 'evidence': []},
        ]
        verdict = reviewer.validate_result(self.result, self.criteria, self.documents)
        report = {**self.result, 'verdict': verdict, 'taskId': 'test', 'inputHash': 'a' * 64,
                  'reviewedAt': '2026-11-26', 'engine': {'model': 'gemini-4-neon-medium'}}
        output = reviewer.render_review({'title': 'مهمة', 'department': 'قسم', 'committee': 'لجنة'}, report, self.criteria)
        self.assertIn('تقرير نواقص المستندات', output)
        self.assertIn('غير معتمد — يحتاج استكمالًا', output)
        self.assertIn('دليل التنفيذ</b> — ناقص', output)
        self.assertIn('اعتماد الجهة المختصة</b> — غير متحقق', output)
        self.assertIn('&lt;test&gt;', output)
        self.assertIn('a' * 64, output)

    def test_approval_report_identifies_document_version(self):
        verdict = reviewer.validate_result(self.result, self.criteria, self.documents)
        report = {**self.result, 'verdict': verdict, 'taskId': 'test', 'inputHash': 'b' * 64,
                  'reviewedAt': '2026-11-26', 'engine': {'model': 'gemini-4-neon-medium'}}
        output = reviewer.render_review({'title': 'مهمة', 'department': 'قسم', 'committee': 'لجنة'}, report, self.criteria)
        self.assertIn('قرار اعتماد آلي للمستندات', output)
        self.assertIn('معتمد آليًا', output)
        self.assertNotIn('النواقص والعناصر', output)
        self.assertIn('b' * 64, output)

class RequiredMinutesAndEvidence(unittest.TestCase):
    def setUp(self):
        self.task = {'id': 'test', 'title': 'نشر الجدول', 'department': 'قسم القراءات',
                     'committee': 'لجنة العلاقات العامة والإعلام', 'deliverable': 'جدول منشور', 'evidence': 'الجدول المنشور'}
        self.criteria = reviewer.criteria_from('', self.task)
        self.documents = {'مستند.txt': {'lines': {'سطر 1': 'محتوى قابل للتحقق في اختبار بوابة القرار'}, 'limitations': []}}
        self.result = {'summary': 'اختبار بوابة القرار', 'recommendations': [], 'limitations': [], 'criteria': [
            {'id': row['id'], 'status': 'مستوفى', 'comment': 'تم فحص الشرط',
             'evidence': [{'file': 'مستند.txt', 'locator': 'سطر 1', 'quote': 'محتوى قابل للتحقق'}]}
            for row in self.criteria]}

    def test_both_artifacts_required_for_every_catalog_task(self):
        catalog = json.loads((reviewer.PROJECT / 'netlify/functions/lib/committeeCatalog.json').read_text())
        for task in catalog:
            criteria = reviewer.criteria_from('', task)
            self.assertEqual([row['kind'] for row in criteria if 'kind' in row], ['minutes', 'work_evidence'], task['id'])

    def test_missing_either_artifact_blocks_approval(self):
        for kind in ('minutes', 'work_evidence'):
            with self.subTest(missing=kind):
                result = json.loads(json.dumps(self.result))
                criterion = next(row for row in self.criteria if row.get('kind') == kind)
                assessment = next(row for row in result['criteria'] if row['id'] == criterion['id'])
                assessment.update(status='ناقص', comment='المستند المطلوب غير مرفق', evidence=[])
                verdict = reviewer.validate_result(result, self.criteria, self.documents)
                self.assertEqual(reviewer.document_decision(verdict)['status'], 'incomplete')
                result['criteria'].remove(assessment)
                with self.assertRaises(ValueError):
                    reviewer.validate_result(result, self.criteria, self.documents)

    def test_unreadable_artifact_suspends_approval(self):
        criterion = next(row for row in self.criteria if row.get('kind') == 'work_evidence')
        next(row for row in self.result['criteria'] if row['id'] == criterion['id']).update(status='غير متحقق', evidence=[])
        self.assertEqual(reviewer.validate_result(self.result, self.criteria, self.documents), 'تعذر التحقق')

    def test_incomplete_minutes_blocks_approval_even_with_both_artifacts(self):
        self.result['criteria'][2].update(status='ناقص', comment='تاريخ الاجتماع غير مدون', evidence=[])
        self.assertEqual(reviewer.validate_result(self.result, self.criteria, self.documents), 'يحتاج استكمالًا')

    def test_report_has_separate_minutes_and_work_evidence_assessments(self):
        report = {**self.result, 'verdict': 'مستوفٍ مبدئيًا', 'taskId': 'test', 'inputHash': 'c' * 64,
                  'reviewedAt': '2026-11-26', 'engine': {'model': 'gemini-4-neon-medium'}}
        output = reviewer.render_review(self.task, report, self.criteria)
        self.assertIn('<b>المحضر</b>: مستوفى', output)
        self.assertIn('<b>شاهد العمل</b>: مستوفى', output)


class AzurePublishing(unittest.TestCase):
    def setUp(self):
        self.endpoint = 'https://committees.tu-shari3ah.com/api/course/committee-review-ingest'
        self.receipt = {'term': '481', 'taskId': 'QRA-QRA-T001', 'inputHash': 'a' * 64}

    def test_retired_or_untrusted_destination_never_reads_key(self):
        for target in ('https://shari3ahtask.netlify.app/api/course/committee-review-ingest',
                       self.endpoint + '?redirect=elsewhere', self.endpoint.replace('https:', 'http:'),
                       self.endpoint.replace('committees.', 'attacker.committees.')):
            with self.subTest(target=target), patch.object(reviewer, 'ENDPOINT', target), patch.object(reviewer, 'KEY_FILE') as key:
                with self.assertRaises(ValueError):
                    reviewer.review_request({})
                key.read_text.assert_not_called()

    def test_preflight_requires_authenticated_schema_error(self):
        with patch.object(reviewer, 'review_request', return_value=object()), patch.object(reviewer.urllib.request, 'build_opener') as opener:
            for status, body in ((422, {'error': 'بيانات المراجعة غير مكتملة.'}), (401, {'error': 'Unauthorized'}), (422, {'error': 'other'})):
                opener.return_value.open.side_effect = urllib.error.HTTPError(self.endpoint, status, '', {}, io.BytesIO(json.dumps(body).encode()))
                if status == 422 and body['error'] == 'بيانات المراجعة غير مكتملة.':
                    reviewer.check_publish_connection()
                else:
                    with self.assertRaises(RuntimeError):
                        reviewer.check_publish_connection()
            opener.return_value.open.side_effect = None
            with self.assertRaises(RuntimeError):
                reviewer.check_publish_connection()

    def test_publication_requires_exact_receipt_acknowledgement(self):
        expected = 'review:481:QRA-QRA-T001:' + 'a' * 64
        with patch.object(reviewer, 'review_request', return_value=object()), patch.object(reviewer.urllib.request, 'build_opener') as opener:
            for response in ({'ok': True, 'reviewId': expected}, {'ok': True, 'reviewId': expected + 'wrong'}, {'ok': False, 'reviewId': expected}):
                opener.return_value.open.return_value.__enter__.return_value = io.StringIO(json.dumps(response))
                if response == {'ok': True, 'reviewId': expected}:
                    reviewer.publish(self.receipt)
                else:
                    with self.assertRaises(RuntimeError):
                        reviewer.publish(self.receipt)

    def test_post_is_never_redirected(self):
        self.assertIsNone(reviewer.NoPublishRedirect().redirect_request(None, None, 307, '', {}, 'https://elsewhere.invalid'))


if __name__ == '__main__':
    unittest.main()
