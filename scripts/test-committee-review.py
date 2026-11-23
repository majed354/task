#!/usr/bin/env python3
import importlib.util
import tempfile
import unittest
import zipfile
from pathlib import Path

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

if __name__ == '__main__':
    unittest.main()
