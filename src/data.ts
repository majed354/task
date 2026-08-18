import rawCatalog from './generated/taskCatalog.json'
import {
  AcademicTerm,
  addDays,
  buildOperationalWeeks,
  getTemporalState,
  parseLocalDate,
} from './academicCalendar'

export type Department = 'جميع الأقسام' | 'قسم القراءات' | 'قسم الثقافة الإسلامية' | 'قسم الشريعة' | 'قسم الأنظمة'
export type Status = 'قادم' | 'مفتوح' | 'فترة سماح' | 'متأخر'

interface CatalogTask {
  id: string
  department: Exclude<Department, 'جميع الأقسام'>
  coordinator: string
  departmentHead: string
  sourceWeek: number
  sourcePeriod: string
  committee: string
  title: string
  steps: string[]
  outputType: string
  deliverable: string
  phaseType: string
}

export interface Task extends CatalogTask {
  week: number
  period: string
  start: Date
  due: Date
  graceEnd: Date
  status: Status
  objective: string
  checklist: string[]
  templateId: string
  timingNote: string
}

export interface TemplateDefinition {
  id: string
  name: string
  type: 'Word' | 'Excel'
  file: string
  version: string
  category: string
  description: string
  whenToUse: string
  steps: string[]
  qualityChecks: string[]
}

export const departments: Department[] = [
  'جميع الأقسام',
  'قسم القراءات',
  'قسم الثقافة الإسلامية',
  'قسم الشريعة',
  'قسم الأنظمة',
]

function checklistFor(task: CatalogTask) {
  const common = ['اكتمال التاريخ والجهة والمسؤول', 'إرفاق البيانات أو الشواهد المصدرية', 'وجود مراجعة واعتماد واضحين']
  if (task.outputType === 'تقرير') return ['عرض النتائج بأرقام أو شواهد', 'تحليل الفجوات لا الاكتفاء بالوصف', 'توصيات محددة بمسؤول وموعد', ...common]
  if (task.outputType === 'خطة') return ['أهداف قابلة للقياس', 'مؤشر ومستهدف لكل هدف', 'مسؤول وموعد لكل إجراء', ...common]
  if (task.outputType === 'نشاط وفعالية') return ['خطة تنفيذ وقائمة حضور', 'توثيق مناسب يحفظ الخصوصية', 'قياس رضا أو أثر وتحليل نتائجه', ...common]
  if (task.committee.includes('فحص الخطط')) return ['فحص كل خطة بمعيار موحد', 'ربط كل ملاحظة بموضعها', 'تسجيل قرار المعالجة والتحقق من الإقفال', ...common]
  return common
}

function templateFor(task: CatalogTask) {
  if (task.committee.includes('فحص الخطط')) return 'plan-review'
  if (task.outputType === 'خطة') return 'operational-plan'
  if (task.outputType === 'نشاط وفعالية') return 'activity-impact'
  if (['جدول', 'قاعدة بيانات', 'قائمة'].includes(task.outputType)) return 'decision-matrix'
  if (['نموذج', 'ملف أكاديمي'].includes(task.outputType)) return 'quality-checklist'
  return 'completion-report'
}

export function buildTasksForTerm(term: AcademicTerm, today = new Date()): Task[] {
  const weeks = buildOperationalWeeks(term)
  const preparationStart = parseLocalDate(term.start)
  const preparationDue = addDays(preparationStart, term.orientationDays - 1)
  const examsStart = parseLocalDate(term.examsStart)
  const examsDue = parseLocalDate(term.examsEnd)

  return (rawCatalog as CatalogTask[]).map((task) => {
    const mappedWeek = task.sourceWeek === 0 ? 0 : Math.min(task.sourceWeek, term.operationalWeeks)
    const week = mappedWeek > 0 ? weeks[mappedWeek - 1] : null
    const isExams = task.sourceWeek === 16
    const start = isExams ? examsStart : week?.start ?? preparationStart
    const due = isExams ? examsDue : week?.due ?? preparationDue
    const graceEnd = addDays(due, term.graceDays)
    const timingNote = task.sourceWeek === 0
      ? 'قائمة تهيئة غير مقيمة قبل انطلاق المهام الإلزامية'
      : isExams ? 'مهمة ممتدة خلال فترة الاختبارات' : `التسليم الأساسي نهاية دوام الخميس، ثم مهلة سماح ${term.graceDays} أيام`

    return {
      ...task,
      week: isExams ? 16 : mappedWeek,
      period: isExams ? 'فترة الاختبارات' : mappedWeek === 0 ? 'أسبوع التهيئة' : `الأسبوع ${mappedWeek}`,
      start,
      due,
      graceEnd,
      status: getTemporalState(start, due, graceEnd, today),
      objective: `إنجاز «${task.title}» بمخرج ${task.outputType} مكتمل، موثق، وقابل للمراجعة والاستشهاد في أعمال الجودة.`,
      checklist: checklistFor(task),
      templateId: templateFor(task),
      timingNote,
    }
  })
}

export const templates: TemplateDefinition[] = [
  {
    id: 'minutes', name: 'محضر اجتماع لجنة', type: 'Word', file: 'قالب_محضر_اجتماع_لجنة.docx', version: '1.0', category: 'المحاضر',
    description: 'محضر منظم يحول كل قرار إلى إجراء ومسؤول وموعد ودليل إقفال.', whenToUse: 'لكل اجتماع رسمي أو جلسة مراجعة ينتج عنها قرار أو تكليف.',
    steps: ['تعبئة بيانات الاجتماع والحضور', 'تلخيص الموضوعات دون إطالة', 'تسجيل القرار والمسؤول والموعد', 'اعتماد المحضر وإرفاق مصفوفة القرارات'],
    qualityChecks: ['الحضور والاعتذارات موثقة', 'كل قرار له مسؤول وموعد', 'التوقيعات أو الاعتماد موجود'],
  },
  {
    id: 'completion-report', name: 'تقرير إنجاز وتحليل مهمة', type: 'Word', file: 'قالب_تقرير_إنجاز_وتحليل_مهمة.docx', version: '1.0', category: 'التقارير',
    description: 'قالب موحد يثبت التنفيذ ويحلل النتيجة ويغلق دائرة التحسين.', whenToUse: 'للتقارير الأسبوعية، المواد الإعلامية، والإجراءات التشغيلية المنجزة.',
    steps: ['تحديد الهدف والنطاق', 'إرفاق البيانات والشواهد', 'تحليل النتيجة والفجوات', 'صياغة التوصيات وخطة المتابعة'],
    qualityChecks: ['النتائج مدعومة بمصدر', 'التحليل يتجاوز الوصف', 'التوصيات قابلة للقياس والتنفيذ'],
  },
  {
    id: 'operational-plan', name: 'خطة تشغيلية للجنة', type: 'Word', file: 'قالب_خطة_تشغيلية_للجنة.docx', version: '1.0', category: 'الخطط',
    description: 'خطة تربط الهدف بالمؤشر والمستهدف والإجراء والمسؤول والزمن.', whenToUse: 'عند إعداد خطة سنوية أو فصلية أو خطة تحسين.',
    steps: ['صياغة أهداف قابلة للقياس', 'تحديد مؤشرات ومستهدفات', 'توزيع المسؤوليات والموارد', 'إضافة آلية متابعة وإقفال'],
    qualityChecks: ['لا يوجد هدف بلا مؤشر', 'كل إجراء له مسؤول وموعد', 'المستهدفات قابلة للتحقق'],
  },
  {
    id: 'activity-impact', name: 'تقرير نشاط وقياس أثر', type: 'Word', file: 'قالب_تقرير_نشاط_وقياس_أثر.docx', version: '1.0', category: 'الأنشطة',
    description: 'يوثق التنفيذ والمشاركة ويقيس الرضا أو الأثر بدل الاكتفاء بالصور.', whenToUse: 'للأنشطة الطلابية، الورش، البرامج البحثية والشراكات المجتمعية.',
    steps: ['توثيق الخطة والفئة المستهدفة', 'تسجيل التنفيذ والحضور', 'تحليل أداة قياس الأثر', 'إصدار توصيات التحسين'],
    qualityChecks: ['عدد المستفيدين موثق', 'أداة القياس مرفقة', 'الصور تراعي الخصوصية', 'التحسين مبني على النتيجة'],
  },
  {
    id: 'decision-matrix', name: 'مصفوفة متابعة القرارات', type: 'Excel', file: 'مصفوفة_متابعة_القرارات.xlsx', version: '1.0', category: 'المتابعة',
    description: 'سجل حي للقرارات والمسؤولين والمواعيد ونسب الإنجاز والأدلة.', whenToUse: 'بعد كل اجتماع ولمتابعة القوائم والجداول وقواعد البيانات.',
    steps: ['إدخال القرار ومصدره', 'تعيين المسؤول والموعد', 'تحديث الحالة ونسبة الإنجاز', 'ربط دليل الإقفال واعتماد النتيجة'],
    qualityChecks: ['لا يوجد قرار بلا مالك', 'التواريخ بصيغة صحيحة', 'الحالة مدعومة بدليل'],
  },
  {
    id: 'quality-checklist', name: 'قائمة فحص جودة الملف', type: 'Excel', file: 'قائمة_فحص_جودة_الملف.xlsx', version: '1.0', category: 'التقييم',
    description: 'تقييم موزون للاكتمال والموثوقية والتحليل والتحسين وقابلية الاستشهاد.', whenToUse: 'قبل رفع أي ملف وبعد المراجعة الآلية أو البشرية.',
    steps: ['تقييم كل معيار من 0 إلى 5', 'إضافة شاهد أو ملاحظة', 'مراجعة النتيجة الموزونة', 'تحديد قرار الاعتماد والتحسينات'],
    qualityChecks: ['كل درجة لها مبرر', 'الأوزان تساوي 100%', 'القرار مرتبط بالنتيجة'],
  },
  {
    id: 'plan-review', name: 'نموذج فحص الخطط العلمية', type: 'Excel', file: 'نموذج_فحص_الخطط_العلمية.xlsx', version: '1.0', category: 'الفحص',
    description: 'نموذج مستقل لفحص الخطط وتسجيل الملاحظة وموقعها وقرار المعالجة.', whenToUse: 'للجان فحص القراءات والدراسات القرآنية والفقه وأصول الفقه.',
    steps: ['تسجيل بيانات الخطة والمحكم', 'فحص البنود المعيارية', 'توثيق الملاحظات والتوصيات', 'متابعة التعديل والإقفال'],
    qualityChecks: ['كل ملاحظة مرتبطة ببند وموضع', 'الحكم مدعوم بتعليل', 'الإقفال موثق بعد التعديل'],
  },
]

export function templateById(id: string) {
  return templates.find((template) => template.id === id) ?? templates[1]
}
