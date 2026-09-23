import csv
import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE = Path(__file__).with_name('course-delivery-scanner.py')
spec = importlib.util.spec_from_file_location('course_delivery_scanner', MODULE)
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)


class CourseProgressTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.register = self.root / '0-الأدلة-والقوالب/قوائم-المقررات/سجل-الشعب-٤٧٢.csv'
        self.register.parent.mkdir(parents=True)

    def seed(self, count):
        rows = []
        for index in range(1, count + 1):
            section = f'{index:03}'
            base = f'1-التقارير/٤٧٢/SHR/2001000-مقرر/الشعب/{section}'
            rows.append({'رمز_القسم': 'SHR', 'البرنامج': 'اختبار', 'رمز_المقرر': '2001000',
                         'اسم_المقرر': 'مقرر الاختبار', 'الشعبة_التنظيمية': section,
                         'عضو_هيئة_التدريس': 'اسم داخلي', 'رقم_الشعبة_الرسمي': '',
                         'مسار_الشعبة': base, 'تقرير_الشعبة': base + '/01-تقرير-المقرر',
                         'قياس_مخرجات_الشعبة': base + '/02-قياس-المخرجات',
                         'تقرير_المقرر_المجمع': '1-التقارير/٤٧٢/00-التقارير-المجمعة-للمقررات/2001000'})
        with self.register.open('w', encoding='utf-8-sig', newline='') as handle:
            writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        return rows

    def deliver(self, relative):
        path = self.root / relative / 'تقرير.docx'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'nonempty-test-file')

    def test_four_sections_one_report_is_ten_percent(self):
        rows = self.seed(4)
        self.deliver(rows[0]['تقرير_الشعبة'])
        _, public = scanner.inspect(self.root)
        course = public['المقررات'][0]
        self.assertEqual((course['عدد_المنجز'], course['عدد_المتطلبات']), (1, 10))
        self.assertEqual(public['الإجمالي']['الشعب_ذات_أي_تقرير'], 1)

    def test_partial_report_credits_only_named_sections(self):
        self.seed(4)
        base = '1-التقارير/٤٧٢/SHR/2001000-مقرر'
        self.deliver(base + '/04-تقارير-الأعضاء-الجزئية/ش001+ش002-عضو')
        self.deliver(base + '/04-تقارير-الأعضاء-الجزئية/قيد-المطابقة-عضو')
        _, public = scanner.inspect(self.root)
        course = public['المقررات'][0]
        self.assertEqual((course['عدد_المنجز'], course['عدد_المتطلبات']), (2, 10))
        self.assertEqual(course['تقارير_جزئية_بانتظار_الإسناد'], 1)
        self.assertEqual([s['التقرير'] for s in course['الشعب']], ['تغطية جماعية', 'تغطية جماعية', 'غير مسلّم', 'غير مسلّم'])

    def test_single_section_has_two_requirements(self):
        rows = self.seed(1)
        self.deliver(rows[0]['تقرير_الشعبة'])
        _, public = scanner.inspect(self.root)
        course = public['المقررات'][0]
        self.assertEqual((course['عدد_المنجز'], course['عدد_المتطلبات']), (1, 2))


if __name__ == '__main__':
    unittest.main()
