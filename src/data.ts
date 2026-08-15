export type Department = 'جميع الأقسام' | 'قسم القراءات' | 'قسم الثقافة الإسلامية' | 'قسم الشريعة' | 'قسم الأنظمة'
export type Status = 'مكتمل' | 'قيد التنفيذ' | 'قادم' | 'يحتاج انتباهًا'

export interface Task {
  id: string
  week: number
  title: string
  committee: string
  department: Department
  deliverable: string
  due: string
  status: Status
  progress: number
  quality: number | null
  objective: string
  steps: string[]
  checklist: string[]
  template: string
}

export const departments: Department[] = [
  'جميع الأقسام',
  'قسم القراءات',
  'قسم الثقافة الإسلامية',
  'قسم الشريعة',
  'قسم الأنظمة',
]

export const weeklyProgress = [
  { week: 1, label: 'التهيئة', progress: 100, completed: 12, total: 12 },
  { week: 2, label: 'الانطلاق', progress: 92, completed: 11, total: 12 },
  { week: 3, label: 'التنفيذ', progress: 78, completed: 14, total: 18 },
  { week: 4, label: 'المتابعة', progress: 64, completed: 9, total: 14 },
  { week: 5, label: 'الأدلة', progress: 42, completed: 5, total: 12 },
  { week: 6, label: 'المراجعة', progress: 18, completed: 2, total: 11 },
  { week: 7, label: 'التحسين', progress: 0, completed: 0, total: 10 },
  { week: 8, label: 'الاعتماد', progress: 0, completed: 0, total: 9 },
]

export const tasks: Task[] = [
  {
    id: 'COM-W04-01', week: 4, title: 'إعداد محضر اجتماع اللجنة', committee: 'جميع اللجان', department: 'جميع الأقسام',
    deliverable: 'محضر معتمد + مصفوفة قرارات', due: '18 ربيع الأول', status: 'مكتمل', progress: 100, quality: 94,
    objective: 'توثيق النقاشات والقرارات وتحويلها إلى إجراءات قابلة للمتابعة والاستشهاد.',
    steps: ['تثبيت بيانات الاجتماع والحضور', 'تلخيص كل موضوع والقرار الناتج', 'إسناد الإجراء وموعده لمسؤول محدد', 'مراجعة المحضر واعتماده'],
    checklist: ['التاريخ والمكان والحضور مكتملة', 'كل قرار له مسؤول وموعد', 'وجود الاعتماد المطلوب'], template: 'قالب محضر لجنة'
  },
  {
    id: 'QRA-W04-02', week: 4, title: 'فحص خطط تخصص القراءات', committee: 'لجنة فحص الخطط — القراءات', department: 'قسم القراءات',
    deliverable: 'تقرير فحص + جدول ملاحظات', due: '19 ربيع الأول', status: 'قيد التنفيذ', progress: 72, quality: null,
    objective: 'التحقق من اتساق الخطط الدراسية مع التوصيفات والجدول ومتطلبات الجودة.',
    steps: ['حصر خطط المقررات', 'مطابقة الموضوعات والأسابيع', 'تسجيل الفجوات والتعارضات', 'إصدار توصيات محددة'],
    checklist: ['مراجعة جميع المقررات', 'الملاحظة مرتبطة بموضعها', 'التوصية قابلة للتنفيذ'], template: 'قالب فحص خطط القراءات'
  },
  {
    id: 'QRA-W04-03', week: 4, title: 'فحص خطط الدراسات القرآنية', committee: 'لجنة فحص الخطط — الدراسات القرآنية', department: 'قسم القراءات',
    deliverable: 'تقرير فحص مستقل', due: '20 ربيع الأول', status: 'قيد التنفيذ', progress: 58, quality: null,
    objective: 'مراجعة الخطط الخاصة بالدراسات القرآنية بصورة مستقلة ودقيقة.',
    steps: ['جمع الخطط المعتمدة', 'فحص التوافق مع التوصيف', 'توثيق الملاحظات', 'إرفاق خطة المعالجة'],
    checklist: ['الصيغة المعتمدة', 'الأسابيع والموضوعات متطابقة', 'الملاحظات موثقة'], template: 'قالب فحص الدراسات القرآنية'
  },
  {
    id: 'SHR-W04-04', week: 4, title: 'فحص خطط تخصص الفقه', committee: 'لجنة فحص الخطط — الفقه', department: 'قسم الشريعة',
    deliverable: 'تقرير فحص + توصيات', due: '20 ربيع الأول', status: 'يحتاج انتباهًا', progress: 34, quality: null,
    objective: 'ضمان اتساق خطط مقررات الفقه مع مخرجات البرنامج.',
    steps: ['حصر المقررات', 'مطابقة الخطط بالتوصيفات', 'تحليل الفجوات', 'إعداد التوصيات'],
    checklist: ['اكتمال الحصر', 'سلامة المقارنة', 'وضوح التوصيات'], template: 'قالب فحص خطط الفقه'
  },
  {
    id: 'SHR-W04-05', week: 4, title: 'فحص خطط أصول الفقه', committee: 'لجنة فحص الخطط — أصول الفقه', department: 'قسم الشريعة',
    deliverable: 'تقرير فحص مستقل', due: '21 ربيع الأول', status: 'قيد التنفيذ', progress: 61, quality: null,
    objective: 'تقييم خطط مقررات أصول الفقه بمعيار مستقل.',
    steps: ['تحميل النسخ المعتمدة', 'تحليل الاتساق', 'تسجيل الملاحظات', 'اعتماد التقرير'],
    checklist: ['كل مقرر مراجع', 'الحكم مدعوم بدليل', 'التقرير قابل للاعتماد'], template: 'قالب فحص خطط أصول الفقه'
  },
  {
    id: 'LAW-W04-06', week: 4, title: 'مراجعة الجداول ومعالجة التعارضات', committee: 'لجنة الجداول', department: 'قسم الأنظمة',
    deliverable: 'كشف تعارضات + نسخة معالجة', due: '21 ربيع الأول', status: 'مكتمل', progress: 100, quality: 88,
    objective: 'ضمان سلامة الجدول وخلوه من تعارضات القاعات والأعضاء.',
    steps: ['تصدير الجدول الحديث', 'فحص تعارض القاعات', 'فحص تعارض أعضاء هيئة التدريس', 'توثيق المعالجات'],
    checklist: ['لا يوجد تعارض مكاني', 'لا يوجد تعارض زمني', 'توثيق كل تعديل'], template: 'قالب فحص الجداول'
  },
  {
    id: 'CUL-W04-07', week: 4, title: 'إعداد تقرير الأنشطة الطلابية', committee: 'لجنة الأنشطة الطلابية', department: 'قسم الثقافة الإسلامية',
    deliverable: 'تقرير مصور + قياس أثر', due: '22 ربيع الأول', status: 'قادم', progress: 15, quality: null,
    objective: 'توثيق النشاط وإظهار مشاركة الطلاب والأثر المحقق.',
    steps: ['جمع بيانات النشاط', 'حصر المشاركين', 'تحليل قياس الأثر', 'إرفاق الصور والشواهد'],
    checklist: ['البيانات مكتملة', 'الصور مناسبة للنشر', 'الأثر مقاس بمؤشر واضح'], template: 'قالب تقرير نشاط طلابي'
  },
  {
    id: 'COM-W05-08', week: 5, title: 'تحديث مصفوفة متابعة القرارات', committee: 'جميع اللجان', department: 'جميع الأقسام',
    deliverable: 'مصفوفة محدثة', due: '25 ربيع الأول', status: 'قادم', progress: 0, quality: null,
    objective: 'قياس ما تم تنفيذه من القرارات وتوثيق ما تعثر وسببه.',
    steps: ['مراجعة قرارات المحضر السابق', 'تحديث الحالة', 'إرفاق دليل التنفيذ', 'رصد المعوقات'],
    checklist: ['كل قرار مسجل', 'الحالة محدثة', 'الدليل مرتبط بالقرار'], template: 'مصفوفة متابعة القرارات'
  },
]

export const templates = [
  { name: 'محضر اجتماع لجنة', type: 'Word', version: '3.1', category: 'المحاضر', uses: 28 },
  { name: 'تقرير إنجاز مهمة', type: 'Word', version: '2.4', category: 'التقارير', uses: 41 },
  { name: 'فحص الخطط الدراسية', type: 'Excel', version: '4.0', category: 'الفحص', uses: 19 },
  { name: 'مصفوفة متابعة القرارات', type: 'Excel', version: '2.2', category: 'المتابعة', uses: 35 },
  { name: 'خطة تحسين ومتابعة', type: 'Word', version: '1.8', category: 'التحسين', uses: 16 },
  { name: 'تقرير قياس الأثر', type: 'Word', version: '1.5', category: 'التقييم', uses: 13 },
]
