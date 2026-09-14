import rawCatalog from './generated/taskCatalog.json'
import rawAudit from './generated/catalogAudit.json'
import rawGuides from './generated/taskGuides.json'
import rawGuideAssignments from './generated/taskGuideAssignments.json'
import {
  AcademicTerm,
  buildOperationalWeeks,
  getCommitteePlanStart,
  getCommitteePreparationDue,
  getExamEvent,
  getTemporalState,
  parseLocalDate,
  TemporalStatus,
} from './academicCalendar'

interface CatalogTask {
  id: string
  sourceWeek: number
  committee: string
  title: string
  steps: string[]
  outputType: string
  deliverable: string
}

interface CatalogAudit {
  proposedTaxonomy: {
    taskTypes: Array<{ id: string; canonicalTitle: string; artifactKind: string }>
  }
  recordTypeMap: Record<string, string>
}

interface ProcedureGuide {
  id: string
  nameAr: string
  roles: { directResponsible: string }
  finalOutput: string
  evidenceAttachments: string[]
  evidenceComponents: string[]
}

interface GuideAssignment {
  guideId: string
}

export interface Task {
  id: string
  sourceId: string
  committee: string
  title: string
  outputType: string
  week: number
  start: Date
  due: Date
  graceEnd: Date
  temporalStatus: TemporalStatus
  guideTitle: string
  quickOutput: string
  quickSteps: string[]
  quickEvidence: string
  evidenceComponents: string[]
  responsibilities: {
    executionRole: string
    recordCoordinationRole: string
  }
  scope: {
    id: 'department' | 'each-program' | 'bachelor-program' | 'postgraduate-program'
    label: string
    shortLabel: string
  }
  scheduleAdjusted: boolean
}

const audit = rawAudit as CatalogAudit
const catalog = rawCatalog as CatalogTask[]
const guides = (rawGuides as { guides: ProcedureGuide[] }).guides
const guideById = new Map(guides.map((guide) => [guide.id, guide]))
const guideAssignments = (rawGuideAssignments as { assignments: Record<string, GuideAssignment> }).assignments
const taskTypeById = new Map(audit.proposedTaxonomy.taskTypes.map((type) => [type.id, type]))
const sourceCalendarRecordIds = new Set(Array.from({ length: 60 }, (_, index) => `QRA-T${String(index + 1).padStart(3, '0')}`))
// مهام تغطية أدلة الدراسة الذاتية المضافة بعد المصدر الأصلي
const selfStudyCoverageRecordIds = ['QRA-T071', 'QRA-T072', 'QRA-T073', 'QRA-T074', 'QRA-T075', 'QRA-T076', 'QRA-T077', 'QRA-T078', 'QRA-T079', 'QRA-T080', 'QRA-T081', 'QRA-T082']
for (const id of selfStudyCoverageRecordIds) sourceCalendarRecordIds.add(id)
// يستبقي الكتالوج سجلات المصدر للتدقيق، لكن لا تعرض الواجهة جهات التنسيق أو المهام العامة المشتركة.
const excludedDisplayCommittees = new Set(['منسقو برامج الدراسات العليا', 'جميع اللجان'])

export function normalizeCommitteeName(value: string) {
  if (value === 'جميع اللجان') return 'مهام مشتركة لجميع اللجان'
  if (value === 'منسقو برامج الدراسات العليا') return 'تنسيق برامج الدراسات العليا'
  if (value === 'لجنة الدراسات العليا') return 'لجنة الدراسات العليا والبحث العلمي'
  if (value === 'لجنة الأنشطة الطلابية') return 'لجنة الأنشطة والشؤون الطلابية'
  return value.replace(/\s*–\s*تخصص .+$/, '')
}

const qualityCommittee = 'لجنة الجودة والاعتماد الأكاديمي'
const bachelorQualityCommittee = 'لجنة الجودة والاعتماد لبرامج البكالوريوس'
const postgraduateQualityCommittee = 'لجنة الجودة والاعتماد لبرامج الدراسات العليا'
const studentAffairsCommittee = 'لجنة الأنشطة والشؤون الطلابية'
const mediaCommittee = 'لجنة العلاقات العامة والإعلام'

const committeeOverrides: Record<string, string> = {
  'QRA-T001': mediaCommittee,
  'QRA-T032': studentAffairsCommittee,
  'QRA-T080': studentAffairsCommittee,
  'QRA-T082': studentAffairsCommittee,
}

const executionRoleOverrides: Record<string, string> = {
  'QRA-T001': 'الأعضاء ومنسق أعمال اللجنة، وتتولى لجنة العلاقات العامة والإعلام النشر',
  'QRA-T032': studentAffairsCommittee,
  'QRA-T080': studentAffairsCommittee,
  'QRA-T082': studentAffairsCommittee,
}

const qualityProgramTitleOverrides: Record<string, string> = {
  'QRA-T003': 'إعداد الخطة التشغيلية للبرنامج',
  'QRA-T072': 'مراجعة دليل نظام إدارة الجودة للبرنامج وتحديثه',
}

const taskTitleOverrides: Record<string, string> = {
  'QRA-T001': 'نشر الجدول العام للساعات المكتبية',
}

const scientificActivityWebsiteChecks = [
  { id: 'MEDIA-T001', week: 8, period: 'منتصف الفصل' },
  { id: 'MEDIA-T002', week: 14, period: 'نهاية الفصل' },
] as const

const scopes = {
  department: { id: 'department', label: 'يُنفذ مرة واحدة على مستوى القسم', shortLabel: 'على مستوى القسم' },
  eachProgram: { id: 'each-program', label: 'يُكرر لكل برنامج أكاديمي', shortLabel: 'لكل برنامج' },
  bachelorProgram: { id: 'bachelor-program', label: 'يُنفذ لكل برنامج بكالوريوس', shortLabel: 'لكل برنامج بكالوريوس' },
  postgraduateProgram: { id: 'postgraduate-program', label: 'يُنفذ لكل برنامج دراسات عليا', shortLabel: 'لكل برنامج دراسات عليا' },
} as const

// المهام التي تنتج شواهد مستقلة لكل برنامج، وإن نفذتها لجنة موحدة.
const eachProgramRecordIds = new Set([
  'QRA-T005', 'QRA-T012', 'QRA-T013', 'QRA-T014', 'QRA-T017', 'QRA-T024', 'QRA-T026',
  'QRA-T027', 'QRA-T030', 'QRA-T032', 'QRA-T033', 'QRA-T035', 'QRA-T047', 'QRA-T060',
  'QRA-T078', 'QRA-T079', 'QRA-T080', 'QRA-T082',
])

function scopeFor(record: CatalogTask) {
  if (record.committee.includes('فحص الخطط العلمية')) return scopes.postgraduateProgram
  if (eachProgramRecordIds.has(record.id)) return scopes.eachProgram
  return scopes.department
}

const canonicalCatalog = (() => {
  const firstRecordByType = new Map<string, CatalogTask>()
  for (const record of catalog) {
    if (!sourceCalendarRecordIds.has(record.id)) continue
    if (excludedDisplayCommittees.has(record.committee)) continue
    const typeId = audit.recordTypeMap[record.id]
    if (typeId && !firstRecordByType.has(typeId)) firstRecordByType.set(typeId, record)
  }
  return Array.from(firstRecordByType, ([typeId, record]) => ({ typeId, record }))
})()

function fallbackEvidence(outputType: string) {
  const labels: Record<string, string> = {
    'خطة': 'الخطة النهائية المعتمدة.',
    'تقرير': 'التقرير النهائي المعتمد.',
    'جدول': 'الجدول النهائي المعتمد.',
    'قائمة': 'القائمة النهائية المعتمدة.',
    'مادة إعلامية': 'رابط النسخة المنشورة المعتمدة.',
    'نموذج': 'النموذج المكتمل المعتمد.',
    'ملف أكاديمي': 'الملف الأكاديمي المكتمل.',
    'قاعدة بيانات': 'قاعدة البيانات المحدثة.',
    'نشاط وفعالية': 'تقرير تنفيذ النشاط وأثره.',
    'إجراء تشغيلي': 'إثبات تنفيذ الإجراء.',
  }
  return labels[outputType] ?? 'المخرج النهائي المعتمد.'
}

export function buildTasksForTerm(term: AcademicTerm, today = new Date()): Task[] {
  if (!term.supportsFullCommitteePlan) return []

  const weeks = buildOperationalWeeks(term)
  const preparationStart = getCommitteePlanStart(term)
  const preparationDue = getCommitteePreparationDue(term)
  const exams = getExamEvent(term)

  function resolveSchedule(sourceWeek: number) {
    const isExams = sourceWeek === 16
    const mappedWeek = sourceWeek === 0 ? 0 : Math.min(sourceWeek, weeks.length)
    const operationalWeek = mappedWeek > 0 ? weeks[mappedWeek - 1] : null
    const examsStart = exams ? parseLocalDate(exams.start) : parseLocalDate(term.end)
    const examsEnd = exams ? parseLocalDate(exams.end) : parseLocalDate(term.end)
    return {
      week: isExams ? 16 : mappedWeek,
      start: isExams ? examsStart : operationalWeek?.start ?? preparationStart,
      due: isExams ? examsEnd : operationalWeek?.due ?? preparationDue,
      graceEnd: isExams ? examsEnd : operationalWeek?.graceEnd ?? preparationDue,
      scheduleAdjusted: !isExams && sourceWeek > weeks.length,
    }
  }

  const catalogTasks = canonicalCatalog.flatMap(({ typeId, record }) => {
    const taskType = taskTypeById.get(typeId)
    const outputType = taskType?.artifactKind ?? record.outputType
    const title = taskType?.canonicalTitle ?? record.title
    const schedule = resolveSchedule(record.sourceWeek)
    const assignment = guideAssignments[record.id]
    const guide = assignment ? guideById.get(assignment.guideId) : undefined

    const baseCommittee = committeeOverrides[record.id] ?? normalizeCommitteeName(record.committee)
    const variants = record.committee === qualityCommittee
      ? [
          { suffix: 'BACH', committee: bachelorQualityCommittee, scope: scopes.bachelorProgram },
          { suffix: 'PG', committee: postgraduateQualityCommittee, scope: scopes.postgraduateProgram },
        ]
      : [{ suffix: '', committee: baseCommittee, scope: scopeFor(record) }]

    return variants.map((variant) => ({
      id: variant.suffix ? `${record.id}-${variant.suffix}` : record.id,
      sourceId: record.id,
      committee: variant.committee,
      title: record.committee === qualityCommittee
        ? qualityProgramTitleOverrides[record.id] ?? title
        : taskTitleOverrides[record.id] ?? title,
      outputType,
      week: schedule.week,
      start: schedule.start,
      due: schedule.due,
      graceEnd: schedule.graceEnd,
      temporalStatus: getTemporalState(schedule.start, schedule.due, schedule.graceEnd, today),
      guideTitle: guide?.nameAr ?? `دليل ${outputType}`,
      quickOutput: guide?.finalOutput ?? record.deliverable ?? `إنجاز «${title}».`,
      quickSteps: record.committee === qualityCommittee && record.id === 'QRA-T003'
        ? record.steps.map((step) => step.replace('أهداف القسم', 'أهداف البرنامج'))
        : record.steps,
      quickEvidence: guide?.evidenceAttachments[0] ?? fallbackEvidence(outputType),
      evidenceComponents: guide?.evidenceComponents ?? ['هوية الشاهد ونطاقه', 'النتيجة الأساسية', 'تاريخ الإنجاز', 'المراجعة والاعتماد'],
      responsibilities: {
        executionRole: record.committee === qualityCommittee
          ? variant.committee
          : executionRoleOverrides[record.id] ?? normalizeCommitteeName(guide?.roles.directResponsible ?? baseCommittee),
        recordCoordinationRole: 'منسق أعمال اللجنة',
      },
      scope: variant.scope,
      scheduleAdjusted: schedule.scheduleAdjusted,
    }))
  })

  const websiteCheckTasks: Task[] = scientificActivityWebsiteChecks.map((definition) => {
    const schedule = resolveSchedule(definition.week)
    return {
      id: definition.id,
      sourceId: definition.id,
      committee: mediaCommittee,
      title: `التأكد من تحديث موقع النشاط العلمي للأعضاء — ${definition.period}`,
      outputType: 'سجل تحقق',
      week: schedule.week,
      start: schedule.start,
      due: schedule.due,
      graceEnd: schedule.graceEnd,
      temporalStatus: getTemporalState(schedule.start, schedule.due, schedule.graceEnd, today),
      guideTitle: 'دليل التحقق من تحديث الموقع',
      quickOutput: `سجل تحقق مختصر ومعتمد لتحديث موقع النشاط العلمي في ${definition.period}.`,
      quickSteps: [
        'تذكير الأعضاء بتحديث الأنشطة والمنجزات العلمية في الموقع',
        'مراجعة اكتمال التحديث وحصر ما يحتاج إلى استكمال',
        'توثيق رابط الموقع وتاريخ التحقق وإقفال الملاحظات',
      ],
      quickEvidence: 'رابط موقع النشاط العلمي مرفقًا بسجل التحقق وتاريخ المراجعة.',
      evidenceComponents: ['رابط الموقع', 'تاريخ التحقق', 'حالة التحديث', 'الملاحظات المستكملة'],
      responsibilities: {
        executionRole: `${mediaCommittee} بالتنسيق مع الأعضاء`,
        recordCoordinationRole: 'منسق أعمال اللجنة',
      },
      scope: scopes.department,
      scheduleAdjusted: schedule.scheduleAdjusted,
    }
  })

  return [...catalogTasks, ...websiteCheckTasks]
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
    task.outputType,
    task.guideTitle,
    task.scope.label,
    task.quickSteps.join(' '),
    task.quickEvidence,
    task.evidenceComponents.join(' '),
  ].join(' '))
}
