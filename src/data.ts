import rawCatalog from './generated/taskCatalog.json'
import rawAudit from './generated/catalogAudit.json'
import rawGuides from './generated/taskGuides.json'
import rawGuideAssignments from './generated/taskGuideAssignments.json'
import {
  AcademicTerm,
  addDays,
  buildOperationalWeeks,
  getExamEvent,
  getTemporalState,
  parseLocalDate,
  TemporalStatus,
} from './academicCalendar'

export type DepartmentName = 'قسم القراءات' | 'قسم الثقافة الإسلامية' | 'قسم الشريعة' | 'قسم الأنظمة'
export type Department = 'جميع الأقسام' | DepartmentName
export type DeliveryStatus = 'بانتظار الربط'
export type PrivacyClass = 'داخلي' | 'مقيد — لا تعرض البيانات داخل البوابة'

export interface CatalogTask {
  id: string
  department: DepartmentName
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

interface TaxonomyTaskType {
  id: string
  guideKey: string
  canonicalTitle: string
  ownerDomain: string
  processClass: string
  artifactKind: string
  proposedCadence: string
}

interface CatalogAudit {
  proposedRenames: Array<{ recordIds: string[]; proposedTitle: string }>
  proposedTaxonomy: {
    ownerDomains: Array<{ id: string; label: string }>
    processClasses: Array<{ id: string; label: string }>
    cadences: Array<{ id: string; label: string; definition: string }>
    taskTypes: TaxonomyTaskType[]
  }
  recordTypeMap: Record<string, string>
}

export interface TaskGuide {
  id: string
  title: string
  objective: string
  inputs: string[]
  steps: string[]
  evidence: string[]
  acceptanceCriteria: string[]
  commonErrors: string[]
  selfStudyConnections: string[]
  approvalMethod: string
  primaryTemplateId: string
  companionTemplateIds: string[]
}

interface ProcedureGuide {
  id: string
  nameAr: string
  definition: string
  objective: string
  scope: string
  roles: {
    directResponsible: string
    reviewer: string
    approver: string
  }
  inputs: string[]
  steps: Array<{ order: number; title: string; action: string; exitCriterion: string }>
  expectedDuration: { estimate: string; planningNote: string }
  finalOutput: string
  evidenceAttachments: string[]
  fileNamePattern: string
  sharePointFolderPath: string
  reviewAndApproval: { reviewFlow: string[]; requiredRecord: string }
  acceptanceCriteria: string[]
  commonErrors: string[]
  selfStudyRelationship: { useAsEvidence: string; citationMethod: string; privacyGuard: string }
  performanceIndicators: Array<{ name: string; formula: string; proposedTarget: string; direction: string }>
  examples: { accepted: string[]; rejected: string[] }
  cadence: { type: string; trigger: string; followUp: string }
  templateIds: string[]
  noTemplateReason: string | null
}

interface GuideAssignment {
  guideId: string
  primaryTemplateId: string
  companionTemplateIds: string[]
}

export interface Task extends CatalogTask {
  title: string
  week: number
  period: string
  start: Date
  due: Date
  graceEnd: Date
  temporalStatus: TemporalStatus
  deliveryStatus: DeliveryStatus
  taskTypeId: string
  guideId: string
  guideTitle: string
  guideDefinition: string
  guideScope: string
  cadence: string
  processClass: string
  objective: string
  inputs: string[]
  executionSteps: string[]
  evidence: string[]
  acceptanceCriteria: string[]
  commonErrors: string[]
  selfStudyConnections: string[]
  approvalMethod: string
  approvalFlow: string[]
  expectedDuration: string
  planningNote: string
  finalOutput: string
  performanceIndicators: Array<{ name: string; formula: string; proposedTarget: string; direction: string }>
  acceptedExamples: string[]
  rejectedExamples: string[]
  executionOwner: string
  recordCoordinator: string
  reviewer: string
  approver: string
  primaryTemplateId: string
  companionTemplateIds: string[]
  fileName: string
  proposedSharePointPath: string
  privacyClass: PrivacyClass
  timingNote: string
  scheduleAdjusted: boolean
  earlySubmissionNote: string
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

const audit = rawAudit as CatalogAudit
const catalog = rawCatalog as CatalogTask[]
const guides = (rawGuides as { guides: ProcedureGuide[] }).guides
const guideById = new Map(guides.map((guide) => [guide.id, guide]))
const guideAssignments = (rawGuideAssignments as { assignments: Record<string, GuideAssignment> }).assignments

export const departments: Department[] = [
  'جميع الأقسام',
  'قسم القراءات',
  'قسم الثقافة الإسلامية',
  'قسم الشريعة',
  'قسم الأنظمة',
]

const departmentCodes: Record<DepartmentName, string> = {
  'قسم القراءات': 'QRA',
  'قسم الثقافة الإسلامية': 'CUL',
  'قسم الشريعة': 'SHR',
  'قسم الأنظمة': 'LAW',
}

const committeeCodes: Record<string, string> = {
  'لجنة الجودة والاعتماد الأكاديمي': 'QAA',
  'لجنة الاختبارات والنتائج': 'EXAM',
  'لجنة الدراسات العليا': 'PGR',
  'لجنة الإرشاد الأكاديمي': 'ADV',
  'لجنة تطوير المناهج والبرامج الأكاديمية': 'CURR',
  'لجنة العلاقات العامة والإعلام': 'MEDIA',
  'لجنة الأنشطة الطلابية': 'ACT',
  'لجنة الجداول': 'SCHED',
  'لجنة فحص الخطط العلمية': 'PLAN',
  'لجنة فحص الخطط العلمية – تخصص القراءات': 'PLAN-QIR',
  'لجنة فحص الخطط العلمية – تخصص الدراسات القرآنية': 'PLAN-QUR',
  'لجنة فحص الخطط العلمية – تخصص الفقه': 'PLAN-FIQH',
  'لجنة فحص الخطط العلمية – تخصص أصول الفقه': 'PLAN-USUL',
  'منسقو برامج الدراسات العليا': 'PGR-COORD',
  'جميع اللجان': 'ALL',
}

const renamedTitleByRecord = new Map(
  audit.proposedRenames.flatMap((group) => group.recordIds.map((id) => [id, group.proposedTitle] as const)),
)
const taskTypeById = new Map(audit.proposedTaxonomy.taskTypes.map((type) => [type.id, type]))
const processClassById = new Map(audit.proposedTaxonomy.processClasses.map((item) => [item.id, item.label]))

function primaryTemplateFor(task: CatalogTask) {
  const text = `${task.title} ${task.committee}`
  if (task.committee.includes('فحص الخطط')) return 'plan-review'
  if (text.includes('مؤشر') || text.includes('مؤشرات')) return 'kpi-tracker'
  if (text.includes('استبان') || text.includes('رضا') || text.includes('تقييم الدعم')) return 'survey-analysis'
  if (task.committee.includes('الجداول') || text.includes('جدول دراسي') || text.includes('توزيع الشعب')) return 'schedule-planner'
  if (task.committee.includes('الاختبارات') || text.includes('اختبار') || text.includes('تصحيح')) return 'exam-readiness'
  if (text.includes('اعتماد أكاديمي') || text.includes('الأدلة') || text.includes('الشواهد')) return 'evidence-register'
  if (text.includes('تحسين') || text.includes('فجوات') || text.includes('معالجة')) return 'improvement-report'
  if (task.phaseType === 'تسليم نهائي' || text.includes('ختامي') || text.includes('نهائي فصلي')) return 'final-report'
  if (task.outputType === 'خطة') return 'operational-plan'
  if (task.outputType === 'نشاط وفعالية') return 'activity-impact'
  if (['جدول', 'قاعدة بيانات', 'قائمة'].includes(task.outputType)) return 'decision-matrix'
  if (['نموذج', 'ملف أكاديمي'].includes(task.outputType)) return 'quality-checklist'
  return 'completion-report'
}

function companionTemplates(primaryTemplateId: string) {
  const companions = ['minutes', 'evidence-register', 'quality-checklist']
  return companions.filter((id) => id !== primaryTemplateId)
}

function detailSet(task: CatalogTask, guideTitle: string): Omit<TaskGuide, 'id' | 'title' | 'primaryTemplateId' | 'companionTemplateIds'> {
  const commonInputs = ['التكليف أو الخطة المعتمدة ذات الصلة', 'البيانات والمستندات المصدرية المحدثة', 'النماذج والقرارات السابقة المرتبطة بالمهمة']
  const commonEvidence = ['نسخة المخرج النهائية المعتمدة', 'سجل المراجعة أو محضر القرار', 'قائمة المرفقات وروابطها داخل المستودع المؤسسي']
  const commonAcceptance = ['اكتمال البيانات الوصفية والتاريخ والإصدار', 'اتساق النتيجة مع البيانات والمصدر', 'تحديد مسؤول وموعد لكل إجراء لاحق', 'توثيق المراجعة والاعتماد قبل الإقفال']
  const commonErrors = ['الاعتماد على وصف بلا أرقام أو شواهد', 'رفع مسودة على أنها نسخة نهائية', 'غياب مالك الإجراء أو موعده', 'إدراج بيانات شخصية في اسم الملف أو هذه البوابة']

  if (task.outputType === 'خطة') {
    return {
      objective: `إنتاج ${guideTitle} يربط الهدف بالمؤشر والمستهدف والإجراء والمسؤول والزمن والدليل.`,
      inputs: ['الأهداف الاستراتيجية وخطة القسم', 'نتائج الفترة السابقة وفجواتها', ...commonInputs],
      steps: [...task.steps, 'ربط كل هدف بمؤشر ومستهدف ومبادرة', 'مراجعة الموارد والمخاطر ثم توثيق الاعتماد'],
      evidence: ['الخطة المعتمدة', 'مصفوفة الأهداف والمؤشرات', ...commonEvidence],
      acceptanceCriteria: ['لا يوجد هدف بلا مؤشر ومستهدف', ...commonAcceptance],
      commonErrors: ['استخدام عبارات عامة غير قابلة للقياس', ...commonErrors],
      selfStudyConnections: ['التخطيط التشغيلي ومواءمة أهداف البرنامج', 'متابعة مؤشرات الأداء وإغلاق دائرة التحسين'],
      approvalMethod: 'مراجعة اللجنة ثم اعتماد السلطة المحددة في قرار التشكيل والمسار المحلي المعتمد.',
    }
  }

  if (task.committee.includes('فحص الخطط')) {
    return {
      objective: 'تنفيذ فحص معياري مستقل للخطة وتوثيق كل ملاحظة وقرار معالجة حتى الإقفال.',
      inputs: ['نسخة الخطة ورقم إصدارها', 'معايير الفحص المعتمدة', 'سجل الملاحظات أو التحكيم السابق'],
      steps: [...task.steps, 'ربط كل ملاحظة ببند وموضع محدد', 'التحقق من الاستجابة وإثبات الإقفال'],
      evidence: ['نموذج الفحص المكتمل', 'نسخة الخطة قبل المعالجة وبعدها', 'قرار اللجنة وسجل الإقفال'],
      acceptanceCriteria: ['كل ملاحظة محددة الموضع ومعللة', 'بقاء اللجان العلمية المتخصصة مستقلة', ...commonAcceptance],
      commonErrors: ['دمج نتائج لجان التخصصات المختلفة', 'ملاحظة عامة بلا موضع أو تعليل', ...commonErrors],
      selfStudyConnections: ['جودة تصميم البرامج والخطط الأكاديمية', 'سلامة المراجعة والتحسين المستمر'],
      approvalMethod: 'تعتمد النتيجة وفق قرار تشكيل لجنة التخصص والجهة الأكاديمية المخولة؛ لا يثبت النصاب هنا دون دليل محلي.',
    }
  }

  if (task.outputType === 'نشاط وفعالية') {
    return {
      objective: 'تنفيذ النشاط وتوثيق المشاركة وقياس الرضا أو الأثر وتحويل النتيجة إلى تحسين قابل للمتابعة.',
      inputs: ['خطة النشاط والفئة المستهدفة', 'أداة قياس أثر أو رضا', ...commonInputs],
      steps: [...task.steps, 'جمع نتيجة أداة القياس وتحليلها', 'توثيق التحسين والمسؤول وموعد المتابعة'],
      evidence: ['خطة التنفيذ وقائمة الحضور', 'نتائج القياس وتحليلها', 'توثيق يحفظ الخصوصية', ...commonEvidence],
      acceptanceCriteria: ['عدد المستفيدين ومصدره واضحان', 'التحسين مبني على نتيجة القياس', ...commonAcceptance],
      commonErrors: ['الاكتفاء بالصور أو عدد الحضور', 'نشر صور أو قوائم حساسة بلا ضابط', ...commonErrors],
      selfStudyConnections: ['الأنشطة والخدمات الداعمة', 'مشاركة المستفيدين وقياس الأثر'],
      approvalMethod: 'يراجع تقرير الأثر داخل اللجنة ثم يعتمد وفق المسار المحلي للنشاط.',
    }
  }

  return {
    objective: `إنجاز «${task.title}» كمخرج ${task.outputType} مكتمل وموثق وقابل للمراجعة والاستشهاد.`,
    inputs: commonInputs,
    steps: [...task.steps, 'تحليل النتيجة والفجوات وتحديد الإجراءات', 'فحص الجودة وتوثيق الاعتماد وحفظ الأدلة'],
    evidence: commonEvidence,
    acceptanceCriteria: commonAcceptance,
    commonErrors,
    selfStudyConnections: ['توثيق الممارسة وموثوقية الأدلة', 'تحليل النتائج والتحسين المستمر'],
    approvalMethod: 'مراجعة اللجنة ثم الاعتماد وفق قرار التشكيل ومسار القسم؛ لا يُفترض اسم معتمد نهائيًا من دون ربط محلي.',
  }
}

function privacyFor(task: CatalogTask): PrivacyClass {
  const sensitivePattern = /طلاب|الطلبة|خريج|متعثر|متفوق|حالات خاصة|أوراق الإجابة|التصحيح العشوائي|قاعدة بيانات/
  return sensitivePattern.test(`${task.title} ${task.deliverable}`) ? 'مقيد — لا تعرض البيانات داخل البوابة' : 'داخلي'
}

function fileNameFor(task: CatalogTask, term: AcademicTerm, week: number, templateId: string) {
  const year = term.academicYear.match(/\d{4}/)?.[0] ?? '1448'
  const termCode = term.termType === 'first' ? 'F1' : term.termType === 'second' ? 'F2' : 'SU'
  const weekCode = task.sourceWeek === 16 ? 'EXAM' : `W${String(week).padStart(2, '0')}`
  const departmentCode = departmentCodes[task.department]
  const committeeCode = committeeCodes[task.committee] ?? 'COM'
  const extension = templateById(templateId).type === 'Word' ? 'docx' : 'xlsx'
  return `${year}-${termCode}_${weekCode}_${departmentCode}_${committeeCode}_${task.id}_${templateId}_v01.${extension}`
}

function sharePointPathFor(task: CatalogTask, term: AcademicTerm, pattern?: string) {
  const year = term.academicYear.match(/\d{4}/)?.[0] ?? '1448'
  const termCode = term.termType === 'first' ? 'F1' : term.termType === 'second' ? 'F2' : 'SU'
  const proposedPattern = pattern ?? '/متابعة-أعمال-اللجان/{academicYear}/{termCode}/{departmentCode}/{committeeCode}/{taskId}/'
  return proposedPattern
    .replaceAll('{academicYear}', year)
    .replaceAll('{termCode}', termCode)
    .replaceAll('{departmentCode}', departmentCodes[task.department])
    .replaceAll('{committeeCode}', committeeCodes[task.committee] ?? 'COM')
    .replaceAll('{taskId}', task.id)
}

export function buildTasksForTerm(term: AcademicTerm, today = new Date()): Task[] {
  if (!term.supportsFullCommitteePlan) return []

  const weeks = buildOperationalWeeks(term)
  const preparationStart = parseLocalDate(term.start)
  const preparationDue = addDays(preparationStart, Math.max(term.orientationDays - 1, 0))
  const exams = getExamEvent(term)

  return catalog.map((sourceTask) => {
    const task = { ...sourceTask, title: renamedTitleByRecord.get(sourceTask.id) ?? sourceTask.title }
    const isExams = task.sourceWeek === 16
    const mappedWeekNumber = task.sourceWeek === 0 ? 0 : Math.min(task.sourceWeek, weeks.length)
    const operationalWeek = mappedWeekNumber > 0 ? weeks[mappedWeekNumber - 1] : null
    const examsStart = exams ? parseLocalDate(exams.start) : parseLocalDate(term.end)
    const examsEnd = exams ? parseLocalDate(exams.end) : parseLocalDate(term.end)
    const start = isExams ? examsStart : operationalWeek?.start ?? preparationStart
    const due = isExams ? examsEnd : operationalWeek?.due ?? preparationDue
    const graceEnd = isExams ? examsEnd : operationalWeek?.graceEnd ?? preparationDue
    const scheduleAdjusted = !isExams && task.sourceWeek > 0 && task.sourceWeek > weeks.length
    const typeId = audit.recordTypeMap[task.id] ?? 'TYP-UNMAPPED'
    const taskType = taskTypeById.get(typeId)
    const assignment = guideAssignments[task.id]
    const procedureGuide = assignment ? guideById.get(assignment.guideId) : undefined
    const guideTitle = procedureGuide?.nameAr ?? `دليل ${task.outputType}`
    const primaryTemplateId = assignment?.primaryTemplateId ?? primaryTemplateFor(task)
    const companionTemplateIds = assignment?.companionTemplateIds ?? companionTemplates(primaryTemplateId)
    const fallbackGuide = detailSet(task, guideTitle)
    const executionSteps = procedureGuide
      ? procedureGuide.steps.map((step) => `${step.title}: ${step.action} — معيار الخروج: ${step.exitCriterion}`)
      : fallbackGuide.steps
    const approvalMethod = procedureGuide
      ? `${procedureGuide.reviewAndApproval.reviewFlow.join(' ← ')}. السجل المطلوب: ${procedureGuide.reviewAndApproval.requiredRecord}`
      : fallbackGuide.approvalMethod
    const timingNote = task.sourceWeek === 0
      ? 'تهيئة غير مقيمة قبل انطلاق نافذة التنفيذ.'
      : isExams
        ? 'مهمة ممتدة داخل فترة الاختبارات المقارنة.'
        : scheduleAdjusted
          ? `أعيدت جدولة المهمة من الأسبوع ${task.sourceWeek} إلى آخر أسبوع تشغيلي متاح؛ يمنع النظام بدء أسبوع تشغيلي داخل الاختبارات.`
          : operationalWeek?.graceShortenedByExams
            ? 'تنتهي المهلة قبل الاختبارات، ولذلك قد تكون أقصر من المهلة المعتادة.'
            : `التسليم الأساسي في يوم عمل متاح، ثم مهلة مقدارها ${term.graceWorkDays} أيام تشغيلية ما لم تبدأ الاختبارات.`

    return {
      ...task,
      week: isExams ? 16 : mappedWeekNumber,
      period: isExams ? 'فترة الاختبارات' : mappedWeekNumber === 0 ? 'أسبوع التهيئة' : `الأسبوع ${mappedWeekNumber}`,
      start,
      due,
      graceEnd,
      temporalStatus: getTemporalState(start, due, graceEnd, today),
      deliveryStatus: 'بانتظار الربط',
      taskTypeId: typeId,
      guideId: assignment?.guideId ?? taskType?.guideKey ?? `task-guide/${typeId}`,
      guideTitle,
      guideDefinition: procedureGuide?.definition ?? fallbackGuide.objective,
      guideScope: procedureGuide?.scope ?? `نطاق المهمة المسجلة: ${task.title}.`,
      cadence: procedureGuide?.cadence.type ?? 'تحتاج اعتمادًا',
      processClass: processClassById.get(taskType?.processClass ?? '') ?? 'تنفيذ ومتابعة',
      objective: procedureGuide?.objective ?? fallbackGuide.objective,
      inputs: procedureGuide?.inputs ?? fallbackGuide.inputs,
      executionSteps,
      evidence: procedureGuide?.evidenceAttachments ?? fallbackGuide.evidence,
      acceptanceCriteria: procedureGuide?.acceptanceCriteria ?? fallbackGuide.acceptanceCriteria,
      commonErrors: procedureGuide?.commonErrors ?? fallbackGuide.commonErrors,
      selfStudyConnections: procedureGuide ? [procedureGuide.selfStudyRelationship.useAsEvidence, procedureGuide.selfStudyRelationship.citationMethod, procedureGuide.selfStudyRelationship.privacyGuard] : fallbackGuide.selfStudyConnections,
      approvalMethod,
      approvalFlow: procedureGuide?.reviewAndApproval.reviewFlow ?? ['فحص ذاتي', 'مراجعة اللجنة', 'الاعتماد وفق المسار المحلي'],
      expectedDuration: procedureGuide?.expectedDuration.estimate ?? 'تحدد وفق حجم المهمة ومدخلاتها.',
      planningNote: procedureGuide?.expectedDuration.planningNote ?? 'توثق أسباب أي تمديد في سجل المهمة.',
      finalOutput: procedureGuide?.finalOutput ?? task.deliverable,
      performanceIndicators: procedureGuide?.performanceIndicators ?? [],
      acceptedExamples: procedureGuide?.examples.accepted ?? [],
      rejectedExamples: procedureGuide?.examples.rejected ?? [],
      executionOwner: procedureGuide?.roles.directResponsible ?? task.committee,
      recordCoordinator: task.coordinator,
      reviewer: procedureGuide?.roles.reviewer ?? task.departmentHead,
      approver: procedureGuide?.roles.approver ?? 'وفق قرار التشكيل والمسار المحلي',
      primaryTemplateId,
      companionTemplateIds,
      fileName: fileNameFor(task, term, mappedWeekNumber, primaryTemplateId),
      proposedSharePointPath: sharePointPathFor(task, term, procedureGuide?.sharePointFolderPath),
      privacyClass: privacyFor(task),
      timingNote,
      scheduleAdjusted,
      earlySubmissionNote: 'يُحتسب التسليم المبكر فقط بعد وصول تاريخ رفع فعلي من SharePoint؛ لا تستنتجه البوابة من التاريخ.',
    }
  })
}

export const templates: TemplateDefinition[] = [
  {
    id: 'minutes', name: 'محضر اجتماع لجنة', type: 'Word', file: 'قالب_محضر_اجتماع_لجنة.docx', version: '1.0', category: 'المحاضر',
    description: 'محضر يحول القرار إلى إجراء ومسؤول وموعد ودليل إقفال.', whenToUse: 'لكل اجتماع رسمي أو جلسة مراجعة ينتج عنها قرار أو تكليف.',
    steps: ['تعبئة بيانات الاجتماع والحضور', 'تلخيص الموضوعات', 'تسجيل القرار والمسؤول والموعد', 'اعتماد المحضر ومتابعة الإقفال'],
    qualityChecks: ['الحضور والاعتذارات موثقة', 'كل قرار له مسؤول وموعد', 'الاعتماد موجود'],
  },
  {
    id: 'operational-plan', name: 'خطة تشغيلية للجنة', type: 'Word', file: 'قالب_خطة_تشغيلية_للجنة.docx', version: '1.0', category: 'الخطط',
    description: 'خطة تربط الهدف بالمؤشر والمستهدف والإجراء والمسؤول والزمن.', whenToUse: 'للخطط السنوية والفصلية وخطط التحسين.',
    steps: ['صياغة أهداف قابلة للقياس', 'تحديد المؤشرات والمستهدفات', 'توزيع المسؤوليات', 'اعتماد آلية المتابعة'],
    qualityChecks: ['لا هدف بلا مؤشر', 'كل إجراء له مالك وموعد', 'المستهدفات قابلة للتحقق'],
  },
  {
    id: 'completion-report', name: 'تقرير إنجاز وتحليل مهمة', type: 'Word', file: 'قالب_تقرير_إنجاز_وتحليل_مهمة.docx', version: '1.0', category: 'التقارير',
    description: 'يثبت التنفيذ ويحلل النتيجة ويغلق دائرة التحسين.', whenToUse: 'للتقارير الدورية والإجراءات المنجزة والمواد الموثقة.',
    steps: ['تحديد الهدف والنطاق', 'إرفاق البيانات', 'تحليل النتيجة والفجوات', 'صياغة الإجراءات'],
    qualityChecks: ['النتائج مدعومة بمصدر', 'التحليل يتجاوز الوصف', 'التوصيات قابلة للقياس'],
  },
  {
    id: 'activity-impact', name: 'تقرير نشاط وقياس أثر', type: 'Word', file: 'قالب_تقرير_نشاط_وقياس_أثر.docx', version: '1.0', category: 'الأنشطة',
    description: 'يوثق التنفيذ والمشاركة ويقيس الأثر بدل الاكتفاء بالصور.', whenToUse: 'للأنشطة والورش والبرامج والشراكات المجتمعية.',
    steps: ['توثيق الخطة والفئة المستهدفة', 'تسجيل التنفيذ', 'تحليل أداة القياس', 'إصدار توصيات التحسين'],
    qualityChecks: ['عدد المستفيدين موثق', 'أداة القياس مرفقة', 'الخصوصية محفوظة'],
  },
  {
    id: 'improvement-report', name: 'تقرير معالجة ملاحظة وفرصة تحسين', type: 'Word', file: 'قالب_تقرير_معالجة_ملاحظة_وفرصة_تحسين.docx', version: '1.0', category: 'التحسين',
    description: 'يربط الفجوة بسببها وإجراء المعالجة والتحقق من الفاعلية والإقفال.', whenToUse: 'للملاحظات وخطط التحسين وتوصيات التقويم أو الاعتماد.',
    steps: ['توصيف الفجوة ودليلها', 'تحليل السبب الجذري', 'خطة المعالجة', 'التحقق من الفاعلية والإقفال'],
    qualityChecks: ['السبب مدعوم', 'الإجراء له مسؤول وموعد', 'فاعلية المعالجة متحققة'],
  },
  {
    id: 'final-report', name: 'التقرير الختامي للجنة', type: 'Word', file: 'قالب_التقرير_الختامي_للجنة.docx', version: '1.0', category: 'الإقفال',
    description: 'ملخص ختامي للأهداف والنتائج والأدلة والتوصيات المفتوحة.', whenToUse: 'عند إقفال الفصل أو السنة أو دورة عمل اللجنة.',
    steps: ['تلخيص النطاق', 'مقارنة النتائج بالمستهدف', 'تحليل الفجوات', 'اعتماد التوصيات والإقفال'],
    qualityChecks: ['التغطية كاملة', 'النتائج مرتبطة بالأدلة', 'المفتوح مرحّل بمسؤول وموعد'],
  },
  {
    id: 'decision-matrix', name: 'مصفوفة متابعة القرارات', type: 'Excel', file: 'مصفوفة_متابعة_القرارات.xlsx', version: '1.0', category: 'المتابعة',
    description: 'سجل للقرارات والمسؤولين والمواعيد والأدلة.', whenToUse: 'بعد الاجتماعات ولمتابعة القوائم والجداول وقواعد البيانات.',
    steps: ['إدخال القرار ومصدره', 'تعيين المسؤول والموعد', 'تحديث الحالة', 'ربط دليل الإقفال'],
    qualityChecks: ['لا قرار بلا مالك', 'التواريخ صحيحة', 'الإقفال مدعوم بدليل'],
  },
  {
    id: 'quality-checklist', name: 'قائمة فحص جودة الملف', type: 'Excel', file: 'قائمة_فحص_جودة_الملف.xlsx', version: '1.0', category: 'التقييم',
    description: 'فحص موزون للاكتمال والموثوقية والتحليل والتحسين.', whenToUse: 'قبل رفع أي ملف وبعد المراجعة.',
    steps: ['تقييم المعايير', 'إضافة الشاهد', 'مراجعة النتيجة', 'تحديد قرار الاعتماد'],
    qualityChecks: ['كل درجة لها مبرر', 'الأوزان مكتملة', 'القرار مرتبط بالنتيجة'],
  },
  {
    id: 'plan-review', name: 'نموذج فحص الخطط العلمية', type: 'Excel', file: 'نموذج_فحص_الخطط_العلمية.xlsx', version: '1.0', category: 'الفحص',
    description: 'فحص مستقل للخطة مع الملاحظة والموضع وقرار المعالجة.', whenToUse: 'للجان القراءات والدراسات القرآنية والفقه وأصول الفقه المستقلة.',
    steps: ['تسجيل بيانات الخطة', 'فحص البنود', 'توثيق الملاحظات', 'متابعة التعديل والإقفال'],
    qualityChecks: ['كل ملاحظة مرتبطة بموضع', 'الحكم معلل', 'الإقفال موثق'],
  },
  {
    id: 'kpi-tracker', name: 'تقرير متابعة مؤشرات الأداء', type: 'Excel', file: 'تقرير_متابعة_مؤشرات_الأداء.xlsx', version: '1.0', category: 'المؤشرات',
    description: 'يتابع القيمة الفعلية والمستهدف والاتجاه والتحليل والإجراء.', whenToUse: 'عند قياس مؤشرات البرنامج أو اللجنة وتحليلها دوريًا.',
    steps: ['تعريف المؤشر ومصدره', 'تسجيل القيم والمستهدف', 'تحليل الاتجاه', 'تحديد الإجراء والمتابعة'],
    qualityChecks: ['صيغة المؤشر واضحة', 'المصدر موثق', 'التحليل مرتبط بالإجراء'],
  },
  {
    id: 'survey-analysis', name: 'تقرير تحليل نتائج استبانة', type: 'Excel', file: 'تقرير_تحليل_نتائج_استبانة.xlsx', version: '1.0', category: 'القياس',
    description: 'يجمع نتائج الاستبانة ويحللها مع ضوابط الخصوصية.', whenToUse: 'لقياس رضا أو رأي المستفيدين وتحويله إلى تحسين.',
    steps: ['تعريف المجتمع والأداة', 'تنظيف الردود المجمعة', 'تحليل النتائج', 'توثيق التوصيات'],
    qualityChecks: ['الاستجابة معروفة', 'لا بيانات شخصية ظاهرة', 'الاستنتاج مدعوم'],
  },
  {
    id: 'evidence-register', name: 'سجل الأدلة والمرفقات', type: 'Excel', file: 'سجل_الأدلة_والمرفقات.xlsx', version: '1.0', category: 'الأدلة',
    description: 'فهرس موحد للهوية والإصدار والمصدر والاعتماد والرابط.', whenToUse: 'مع كل حزمة أدلة أو ملف اعتماد أو دراسة ذاتية.',
    steps: ['تسجيل هوية الدليل', 'تحديد المصدر والإصدار', 'ربط المحك', 'التحقق من الوصول والاعتماد'],
    qualityChecks: ['المعرف فريد', 'الرابط قابل للوصول', 'الإصدار والاعتماد واضحان'],
  },
  {
    id: 'schedule-planner', name: 'نموذج إعداد ومراجعة الجدول الدراسي', type: 'Excel', file: 'نموذج_إعداد_ومراجعة_الجدول_الدراسي.xlsx', version: '1.0', category: 'الجداول',
    description: 'ينظم الشعب والموارد والتعارضات والتعديلات والاعتماد.', whenToUse: 'لإعداد أو مراجعة الجدول الدراسي وتوزيع الشعب.',
    steps: ['حصر المقررات والقيود', 'إعداد المسودة', 'فحص التعارضات', 'توثيق التعديلات والاعتماد'],
    qualityChecks: ['لا تعارضات غير معالجة', 'كل تعديل مسجل', 'نسخة الاعتماد محددة'],
  },
  {
    id: 'exam-readiness', name: 'قائمة جاهزية الاختبارات', type: 'Excel', file: 'قائمة_جاهزية_الاختبارات.xlsx', version: '1.0', category: 'الاختبارات',
    description: 'يتحقق من الجدولة والأدوات واللجان والمراقبة والنزاهة والإقفال.', whenToUse: 'قبل الاختبارات وأثناءها وعند مراجعة النتائج والإجراءات.',
    steps: ['تحديد نطاق الاختبار', 'فحص عناصر الجاهزية', 'تسجيل الملاحظة والإجراء', 'التحقق من الإقفال'],
    qualityChecks: ['كل عنصر له حالة ودليل', 'الملاحظات مسندة', 'الإقفال موثق'],
  },
]

export function templateById(id: string) {
  return templates.find((template) => template.id === id) ?? templates[2]
}

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('ar')
}

export function taskSearchIndex(task: Task) {
  return normalizeSearchText([
    task.id,
    task.title,
    task.committee,
    task.department,
    task.outputType,
    task.guideTitle,
    task.taskTypeId,
    task.deliverable,
    task.executionSteps.join(' '),
  ].join(' '))
}

export function departmentDetails() {
  return (departments.filter((item): item is DepartmentName => item !== 'جميع الأقسام')).map((department) => {
    const first = catalog.find((task) => task.department === department)
    return {
      name: department,
      coordinator: first?.coordinator ?? 'غير محدد',
      head: first?.departmentHead ?? 'غير محدد',
      code: departmentCodes[department],
    }
  })
}
