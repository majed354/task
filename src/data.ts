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
  scheduleAdjusted: boolean
}

const audit = rawAudit as CatalogAudit
const catalog = rawCatalog as CatalogTask[]
const guides = (rawGuides as { guides: ProcedureGuide[] }).guides
const guideById = new Map(guides.map((guide) => [guide.id, guide]))
const guideAssignments = (rawGuideAssignments as { assignments: Record<string, GuideAssignment> }).assignments
const taskTypeById = new Map(audit.proposedTaxonomy.taskTypes.map((type) => [type.id, type]))

export function normalizeCommitteeName(value: string) {
  if (value === 'جميع اللجان') return 'مهام مشتركة لجميع اللجان'
  if (value === 'منسقو برامج الدراسات العليا') return 'تنسيق برامج الدراسات العليا'
  return value.replace(/\s*–\s*تخصص .+$/, '')
}

const canonicalCatalog = (() => {
  const firstRecordByType = new Map<string, CatalogTask>()
  for (const record of catalog) {
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

  return canonicalCatalog.map(({ typeId, record }) => {
    const taskType = taskTypeById.get(typeId)
    const outputType = taskType?.artifactKind ?? record.outputType
    const title = taskType?.canonicalTitle ?? record.title
    const isExams = record.sourceWeek === 16
    const mappedWeek = record.sourceWeek === 0 ? 0 : Math.min(record.sourceWeek, weeks.length)
    const operationalWeek = mappedWeek > 0 ? weeks[mappedWeek - 1] : null
    const examsStart = exams ? parseLocalDate(exams.start) : parseLocalDate(term.end)
    const examsEnd = exams ? parseLocalDate(exams.end) : parseLocalDate(term.end)
    const start = isExams ? examsStart : operationalWeek?.start ?? preparationStart
    const due = isExams ? examsEnd : operationalWeek?.due ?? preparationDue
    const graceEnd = isExams ? examsEnd : operationalWeek?.graceEnd ?? preparationDue
    const assignment = guideAssignments[record.id]
    const guide = assignment ? guideById.get(assignment.guideId) : undefined

    return {
      id: typeId,
      committee: normalizeCommitteeName(record.committee),
      title,
      outputType,
      week: isExams ? 16 : mappedWeek,
      start,
      due,
      graceEnd,
      temporalStatus: getTemporalState(start, due, graceEnd, today),
      guideTitle: guide?.nameAr ?? `دليل ${outputType}`,
      quickOutput: guide?.finalOutput ?? record.deliverable ?? `إنجاز «${title}».`,
      quickSteps: record.steps,
      quickEvidence: guide?.evidenceAttachments[0] ?? fallbackEvidence(outputType),
      evidenceComponents: guide?.evidenceComponents ?? ['هوية الشاهد ونطاقه', 'النتيجة الأساسية', 'تاريخ الإنجاز', 'المراجعة والاعتماد'],
      responsibilities: {
        executionRole: guide?.roles.directResponsible ?? normalizeCommitteeName(record.committee),
        recordCoordinationRole: 'منسق أعمال اللجنة',
      },
      scheduleAdjusted: !isExams && record.sourceWeek > weeks.length,
    }
  })
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
    task.quickSteps.join(' '),
    task.quickEvidence,
    task.evidenceComponents.join(' '),
  ].join(' '))
}
