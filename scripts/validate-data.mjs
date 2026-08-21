import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))

const catalog = await readJson('src/generated/taskCatalog.json')
const audit = await readJson('src/generated/catalogAudit.json')
const guideDocument = await readJson('src/generated/taskGuides.json')
const assignmentDocument = await readJson('src/generated/taskGuideAssignments.json')
const calendar = await readJson('src/config/academicCalendar.json')
const dataSource = await readFile(path.join(root, 'src/data.ts'), 'utf8')

const failures = []
const checks = []
const assert = (condition, message) => {
  if (condition) checks.push(message)
  else failures.push(message)
}
const unique = (values) => new Set(values)
const date = (value) => new Date(`${value}T12:00:00Z`)

const templates = [
  ['minutes', 'قالب_محضر_اجتماع_لجنة.docx'],
  ['operational-plan', 'قالب_خطة_تشغيلية_للجنة.docx'],
  ['completion-report', 'قالب_تقرير_إنجاز_وتحليل_مهمة.docx'],
  ['activity-impact', 'قالب_تقرير_نشاط_وقياس_أثر.docx'],
  ['improvement-report', 'قالب_تقرير_معالجة_ملاحظة_وفرصة_تحسين.docx'],
  ['final-report', 'قالب_التقرير_الختامي_للجنة.docx'],
  ['decision-matrix', 'مصفوفة_متابعة_القرارات.xlsx'],
  ['quality-checklist', 'قائمة_فحص_جودة_الملف.xlsx'],
  ['plan-review', 'نموذج_فحص_الخطط_العلمية.xlsx'],
  ['kpi-tracker', 'تقرير_متابعة_مؤشرات_الأداء.xlsx'],
  ['survey-analysis', 'تقرير_تحليل_نتائج_استبانة.xlsx'],
  ['evidence-register', 'سجل_الأدلة_والمرفقات.xlsx'],
  ['schedule-planner', 'نموذج_إعداد_ومراجعة_الجدول_الدراسي.xlsx'],
  ['exam-readiness', 'قائمة_جاهزية_الاختبارات.xlsx'],
]
const templateIds = unique(templates.map(([id]) => id))

assert(Array.isArray(catalog) && catalog.length === 268, 'الكتالوج يحتوي 268 مهمة')
assert(unique(catalog.map((task) => task.id)).size === catalog.length, 'معرّفات المهام فريدة')
assert(catalog.every((task) => /^[A-Z]{3}-T\d{3}$/.test(task.id)), 'صيغة جميع معرّفات المهام صحيحة')
assert(unique(catalog.map((task) => task.department)).size === 4, 'الأقسام الأربعة ممثلة')
assert(catalog.every((task) => task.coordinator && task.departmentHead), 'سجل المسؤولية مكتمل لكل مهمة')

const requiredPlanCommittees = [
  'لجنة فحص الخطط العلمية – تخصص القراءات',
  'لجنة فحص الخطط العلمية – تخصص الدراسات القرآنية',
  'لجنة فحص الخطط العلمية – تخصص الفقه',
  'لجنة فحص الخطط العلمية – تخصص أصول الفقه',
]
for (const committee of requiredPlanCommittees) {
  assert(catalog.filter((task) => task.committee === committee).length === 6, `${committee} مستقلة وبها 6 مهام`)
}
assert(catalog.filter((task) => task.committee === 'لجنة الجداول').length === 16, 'لجنة الجداول موجودة وبها 16 مهمة')

const taskTypes = audit?.proposedTaxonomy?.taskTypes ?? []
assert(taskTypes.length === 64, 'أنواع المهام المركزية عددها 64')
assert(Object.keys(audit?.recordTypeMap ?? {}).length === 268, 'كل المهام مرتبطة بنوع مركزي')
assert(catalog.every((task) => audit.recordTypeMap[task.id]), 'لا توجد مهمة بلا نوع مركزي')

const guides = guideDocument.guides ?? []
const guideIds = unique(guides.map((guide) => guide.id))
const assignments = assignmentDocument.assignments ?? {}
assert(guides.length === 19 && guideIds.size === 19, 'الأدلة المركزية عددها 19 ومعرّفاتها فريدة')
assert(guides.every((guide) => guide.steps.length >= 2 && guide.steps.length <= 4), 'كل دليل يحتوي 2–4 خطوات')
assert(guides.every((guide) => guide.evidenceAttachments.length === 1), 'كل دليل يحدد شاهدًا واحدًا كافيًا')
assert(guides.every((guide) => guide.inputs.length <= 2), 'مدخلات الأدلة مختصرة إلى عنصرين بحد أقصى')
assert(guides.every((guide) => guide.acceptanceCriteria.length <= 2), 'معايير القبول مختصرة إلى عنصرين بحد أقصى')
assert(guides.every((guide) => guide.commonErrors.length === 1), 'كل دليل يوضح الخطأ الأهم فقط')
assert(Object.keys(assignments).length === 268, 'ملف الربط يحتوي 268 إحالة')
assert(catalog.every((task) => assignments[task.id]), 'كل مهمة مرتبطة بدليل وقالب')
assert(Object.keys(assignments).every((taskId) => catalog.some((task) => task.id === taskId)), 'لا توجد إحالات لمهام مجهولة')
assert(guides.every((guide) => Object.values(assignments).some((assignment) => assignment.guideId === guide.id)), 'كل الأدلة المركزية مستخدمة فعليًا')

const requiredGuideFields = [
  'definition', 'objective', 'scope', 'roles', 'inputs', 'steps', 'expectedDuration', 'finalOutput',
  'evidenceAttachments', 'fileNamePattern', 'sharePointFolderPath', 'reviewAndApproval',
  'acceptanceCriteria', 'commonErrors', 'selfStudyRelationship', 'performanceIndicators', 'examples',
]
assert(
  guides.every((guide) => requiredGuideFields.every((field) => guide[field] && (!Array.isArray(guide[field]) || guide[field].length))),
  'كل دليل مكتمل عناصر التنفيذ والجودة والدراسة الذاتية',
)

for (const [taskId, assignment] of Object.entries(assignments)) {
  assert(guideIds.has(assignment.guideId), `${taskId}: الدليل معروف`)
  const assignedTemplates = [assignment.primaryTemplateId, ...(assignment.companionTemplateIds ?? [])]
  assert(assignedTemplates.every((id) => templateIds.has(id)), `${taskId}: القوالب معروفة`)
  const guide = guides.find((item) => item.id === assignment.guideId)
  assert(assignedTemplates.every((id) => guide?.templateIds?.includes(id)), `${taskId}: القوالب مذكورة في دليلها`)
}

const officeHoursTaskIds = ['QRA-T001', 'CUL-T001', 'SHR-T001', 'LAW-T001']
for (const taskId of officeHoursTaskIds) {
  const task = catalog.find((item) => item.id === taskId)
  const assignment = assignments[taskId]
  assert(task?.deliverable === 'الجدول العام المنشور للساعات المكتبية', `${taskId}: الجدول المنشور هو المخرج الكافي`)
  assert(task?.steps.length === 3 && task.steps[0].includes('ويوقعه') && task.steps[1].includes('اكتمال'), `${taskId}: مسار الساعات المكتبية مطابق`)
  assert(assignment?.guideId === 'guide-office-hours-publication', `${taskId}: مرتبط بدليل الساعات المستقل`)
  assert(assignment?.companionTemplateIds?.length === 0, `${taskId}: لا قوالب مرافقة زائدة`)
}

assert(templates.length === 14 && templateIds.size === 14, 'مكتبة القوالب تحتوي 14 قالبًا فريدًا')
for (const [id, file] of templates) {
  const fullPath = path.join(root, 'public/templates', file)
  try {
    const fileStat = await stat(fullPath)
    const bytes = await readFile(fullPath)
    assert(fileStat.size > 10_000, `${id}: ملف القالب غير فارغ`)
    assert(bytes[0] === 0x50 && bytes[1] === 0x4b, `${id}: ملف Office صالح مبدئيًا`)
    assert(dataSource.includes(`id: '${id}'`) && dataSource.includes(`file: '${file}'`), `${id}: رابط القالب مسجل في التطبيق`)
  } catch {
    failures.push(`${id}: ملف القالب مفقود (${file})`)
  }
}

assert(calendar.title === 'تقويم جامعي رسمي مقارن — بانتظار تقويم جامعة الطائف', 'وسم التقويم المؤقت ظاهر حرفيًا')
assert(calendar.reviewedAt && calendar.reviewDueAt, 'للتقويم تاريخ مراجعة وموعد تحقق تالٍ')
assert(unique(calendar.terms.map((term) => term.termType)).size === 3, 'التقويم يدعم الفصل الأول والثاني والصيفي')

for (const term of calendar.terms) {
  const study = term.events.find((event) => event.eventType === 'study')
  const exams = term.events.find((event) => event.eventType === 'exams')
  assert(Boolean(study), `${term.id}: فترة الدراسة موجودة`)
  assert(
    term.events.every((event) => event.sourceUrl && event.sourceTitle && event.issuingAuthority && event.accessedAt && event.verificationStatus && event.reviewDueAt),
    `${term.id}: مصدر وحالة تحقق لكل حدث`,
  )
  assert(term.events.every((event) => date(event.start) <= date(event.end)), `${term.id}: نطاقات الأحداث صحيحة`)
  if (study && exams) {
    assert(date(study.start) <= date(exams.start) && date(exams.end) <= date(study.end), `${term.id}: الاختبارات داخل نطاق الفصل`)
    const workStart = new Date(date(study.start).getTime() + term.orientationDays * 86_400_000)
    assert(workStart < date(exams.start), `${term.id}: أسبوع التهيئة يسبق التشغيل والاختبارات`)
  }
}

const publicText = [
  dataSource,
  JSON.stringify(catalog),
  JSON.stringify(audit),
  JSON.stringify(guideDocument),
  JSON.stringify(assignmentDocument),
].join('\n')
assert(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(publicText), 'لا توجد عناوين بريد في بيانات البوابة')
assert(!/(?:\+?966|00966)[\s-]*5\d(?:[\s-]*\d){7}/.test(publicText), 'لا توجد أرقام جوال سعودية في بيانات البوابة')
assert(/ليسوا أعضاء|ليس عضوًا|لا يُعد عضوًا|لا يعد[^.،]{0,50}أعضاء/.test(JSON.stringify(guideDocument)), 'سياسة المتعاون الخارجي تمنع اعتباره عضوًا')

if (failures.length) {
  console.error(`فشل التحقق في ${failures.length} بندًا:`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  console.log(`نجح التحقق: ${catalog.length} مهمة، ${taskTypes.length} نوعًا مركزيًا، ${guides.length} دليلًا، ${templates.length} قالبًا.`)
  console.log(`إجمالي التأكيدات المنفذة: ${checks.length}`)
}
