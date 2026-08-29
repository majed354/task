import { readFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'))

const catalog = await readJson('src/generated/taskCatalog.json')
const audit = await readJson('src/generated/catalogAudit.json')
const guideDocument = await readJson('src/generated/taskGuides.json')
const assignmentDocument = await readJson('src/generated/taskGuideAssignments.json')
const calendar = await readJson('src/config/academicCalendar.json')
const dataSource = await readFile(path.join(root, 'src/data.ts'), 'utf8')
const appSource = await readFile(path.join(root, 'src/App.tsx'), 'utf8')
const calendarExportSource = await readFile(path.join(root, 'src/calendarExport.ts'), 'utf8')

const failures = []
const checks = []
const assert = (condition, message) => {
  if (condition) checks.push(message)
  else failures.push(message)
}
const unique = (values) => new Set(values)
const date = (value) => new Date(`${value}T12:00:00Z`)

assert(Array.isArray(catalog) && catalog.length === 268, 'الكتالوج المصدر يحتوي 268 سجلًا')
assert(unique(catalog.map((task) => task.id)).size === catalog.length, 'معرّفات المهام فريدة')
assert(catalog.every((task) => /^[A-Z]{3}-T\d{3}$/.test(task.id)), 'صيغة جميع معرّفات المهام صحيحة')
assert(unique(catalog.map((task) => task.department)).size === 4, 'الأقسام الأربعة ممثلة')
assert(catalog.every((task) => task.coordinator && task.departmentHead), 'سجل المسؤولية مكتمل لكل مهمة')
assert(catalog.every((task) => task.coordinator === 'منسق أعمال اللجان بالقسم'), 'التنسيق معرّف بوظيفة عامة لا باسم شخص')
assert(catalog.every((task) => task.departmentHead === 'رئيس القسم'), 'المراجعة معرّفة بوظيفة عامة لا باسم شخص')
const legacyPersonalNames = ['آمنة قحاف', 'هبة القرشي', 'خلود العصيمي', 'نزار الفطناسي', 'عبدالعزيز الأنصاري', 'فيصل الشمراني', 'خالد الغامدي', 'مهنا الزهراني']
assert(legacyPersonalNames.every((name) => !JSON.stringify(catalog).includes(name)), 'الكتالوج التشغيلي خالٍ من الأسماء الشخصية السابقة')

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

const normalizeCommittee = (value) => value === 'جميع اللجان'
  ? 'مهام مشتركة لجميع اللجان'
  : value === 'منسقو برامج الدراسات العليا'
    ? 'تنسيق برامج الدراسات العليا'
    : value.replace(/\s*–\s*تخصص .+$/, '')
const recordsByType = new Map()
for (const task of catalog) {
  const typeId = audit.recordTypeMap[task.id]
  const records = recordsByType.get(typeId) ?? []
  records.push(task)
  recordsByType.set(typeId, records)
}
assert(recordsByType.size === 64, 'الواجهة تختزل السجلات إلى 64 مهمة موحدة')
assert([...recordsByType.values()].every((records) => unique(records.map((task) => task.sourceWeek)).size === 1), 'موعد كل مهمة موحدة متسق بين السجلات المصدرية')
assert([...recordsByType.values()].every((records) => unique(records.map((task) => normalizeCommittee(task.committee))).size === 1), 'نوع اللجنة متسق لكل مهمة موحدة')
assert(unique(catalog.map((task) => normalizeCommittee(task.committee))).size === 11, 'الواجهة تعرض 11 نوع لجنة وجهة عمل')

const guides = guideDocument.guides ?? []
const guideIds = unique(guides.map((guide) => guide.id))
const assignments = assignmentDocument.assignments ?? {}
assert(guides.length === 19 && guideIds.size === 19, 'الأدلة المركزية عددها 19 ومعرّفاتها فريدة')
assert(guides.every((guide) => guide.steps.length >= 2 && guide.steps.length <= 4), 'كل دليل يحتوي 2–4 خطوات')
assert(guides.every((guide) => guide.evidenceAttachments.length === 1), 'كل دليل يحدد شاهدًا واحدًا كافيًا')
assert(guides.every((guide) => guide.evidenceComponents.length >= 3 && guide.evidenceComponents.length <= 4), 'كل شاهد يوضح 3–4 مكونات عملية')
assert(guides.every((guide) => unique(guide.evidenceComponents).size === guide.evidenceComponents.length), 'مكونات الشاهد غير مكررة داخل الدليل')
assert(guides.every((guide) => !('templateIds' in guide) && !('noTemplateReason' in guide)), 'الأدلة مستقلة عن مكتبة القوالب')
assert(guides.every((guide) => guide.inputs.length <= 2), 'مدخلات الأدلة مختصرة إلى عنصرين بحد أقصى')
assert(guides.every((guide) => guide.acceptanceCriteria.length <= 2), 'معايير القبول مختصرة إلى عنصرين بحد أقصى')
assert(guides.every((guide) => guide.commonErrors.length === 1), 'كل دليل يوضح الخطأ الأهم فقط')
assert(Object.keys(assignments).length === 268, 'ملف الربط يحتوي 268 إحالة')
assert(catalog.every((task) => assignments[task.id]), 'كل مهمة مرتبطة بدليل تنفيذ')
assert(Object.keys(assignments).every((taskId) => catalog.some((task) => task.id === taskId)), 'لا توجد إحالات لمهام مجهولة')
assert(guides.every((guide) => Object.values(assignments).some((assignment) => assignment.guideId === guide.id)), 'كل الأدلة المركزية مستخدمة فعليًا')
assert(Object.values(assignments).every((assignment) => Object.keys(assignment).length === 1 && typeof assignment.guideId === 'string'), 'إحالات المهام لا تحتوي أي ربط بقالب')

const requiredGuideFields = [
  'definition', 'objective', 'scope', 'roles', 'inputs', 'steps', 'expectedDuration', 'finalOutput',
  'evidenceAttachments', 'fileNamePattern', 'reviewAndApproval',
  'acceptanceCriteria', 'commonErrors', 'selfStudyRelationship', 'performanceIndicators', 'examples',
]
assert(
  guides.every((guide) => requiredGuideFields.every((field) => guide[field] && (!Array.isArray(guide[field]) || guide[field].length))),
  'كل دليل مكتمل عناصر التنفيذ والجودة والدراسة الذاتية',
)

for (const [taskId, assignment] of Object.entries(assignments)) {
  assert(guideIds.has(assignment.guideId), `${taskId}: الدليل معروف`)
  const guide = guides.find((item) => item.id === assignment.guideId)
  assert(guide?.evidenceAttachments?.length === 1, `${taskId}: له شاهد واحد عبر دليله`)
  assert(guide?.evidenceComponents?.length >= 3 && guide.evidenceComponents.length <= 4, `${taskId}: مكونات الشاهد مختصرة ومتاحة عبر دليله`)
}

const officeHoursTaskIds = ['QRA-T001', 'CUL-T001', 'SHR-T001', 'LAW-T001']
for (const taskId of officeHoursTaskIds) {
  const task = catalog.find((item) => item.id === taskId)
  const assignment = assignments[taskId]
  assert(task?.deliverable === 'الجدول العام المنشور للساعات المكتبية', `${taskId}: الجدول المنشور هو المخرج الكافي`)
  assert(task?.steps.length === 3 && task.steps[0].includes('ويوقعه') && task.steps[1].includes('اكتمال'), `${taskId}: مسار الساعات المكتبية مطابق`)
  assert(assignment?.guideId === 'guide-office-hours-publication', `${taskId}: مرتبط بدليل الساعات المستقل`)
  assert(Object.keys(assignment ?? {}).length === 1, `${taskId}: لا يرتبط بأي قالب`)
}

const officeHoursGuide = guides.find((guide) => guide.id === 'guide-office-hours-publication')
assert(officeHoursGuide?.evidenceAttachments?.[0] === 'الجدول العام المنشور للساعات المكتبية.', 'شاهد الساعات المكتبية هو الجدول العام المنشور فقط')
assert(officeHoursGuide?.evidenceComponents?.length === 4, 'مكونات جدول الساعات المكتبية محددة بوضوح')

assert(!/(quickTemplateRequired|primaryTemplateId|companionTemplateIds)/.test(dataSource), 'عقد المهمة لا يفرض قالبًا أو يربطه بالتنفيذ')
assert(!/(?:sourceTask|task)\.(?:coordinator|departmentHead)|recordCoordinator/.test(dataSource), 'بيانات العرض لا تستهلك أسماء المنسقين أو رؤساء الأقسام')
assert(!/(AccessGate|committee-portal-access|1429|type="password")/.test(appSource), 'الموقع يفتح مباشرة بلا كلمة مرور أو تسجيل دخول')
assert(!/(SharePoint|sharepoint|powerbi|مساحة التسليم|بانتظار الربط)/i.test(appSource), 'الواجهة مستقلة ولا تعرض ربطًا بمنصة خارجية')
assert(!/(Department|department|الأقسام|قسمي|رئيس القسم)/.test(appSource), 'الواجهة لا تعرض الأقسام أو فلاترها')
assert(/تحميل التقويم/.test(appSource) && /calendar-export/.test(appSource), 'خيار تحميل التقويم ظاهر في الواجهة')
assert(/BEGIN:VCALENDAR/.test(calendarExportSource) && /END:VCALENDAR/.test(calendarExportSource), 'ملف التصدير يستخدم بنية iCalendar القياسية')
assert(/text\/calendar;charset=utf-8/.test(calendarExportSource), 'تنزيل التقويم يعلن نوع الملف الصحيح')
assert(/BEGIN:VALARM/.test(calendarExportSource) && /TRIGGER:-P1D/.test(calendarExportSource), 'كل موعد يتضمن تنبيهًا قبل يوم')
assert(/Google Calendar/.test(appSource) && /تقويم Apple/.test(appSource) && /Outlook/.test(appSource), 'الواجهة توضح تطبيقات التقويم المتوافقة')

assert(calendar.title === 'التقويم التشغيلي للمنظومة', 'عنوان التقويم التشغيلي واضح')
assert(calendar.displayTitle === calendar.title, 'عنوان التقويم الظاهر مطابق للإعداد التشغيلي')
assert(calendar.reviewedAt && calendar.reviewDueAt, 'للتقويم تاريخ مراجعة وموعد تحقق تالٍ')
assert(unique(calendar.terms.map((term) => term.termType)).size === 3, 'التقويم يدعم الفصل الأول والثاني والصيفي')
assert(calendar.terms.find((term) => term.id === '1448-first')?.committeePlanStart === '2026-08-30', 'بداية أعمال اللجان للفصل الأول في 30 أغسطس 2026')

for (const term of calendar.terms) {
  const study = term.events.find((event) => event.eventType === 'study')
  const exams = term.events.find((event) => event.eventType === 'exams')
  assert(Boolean(study), `${term.id}: فترة الدراسة موجودة`)
  assert(Boolean(term.committeePlanStart), `${term.id}: بداية أعمال اللجان موجودة`)
  assert(
    term.events.every((event) => event.sourceUrl && event.sourceTitle && event.issuingAuthority && event.accessedAt && event.verificationStatus && event.reviewDueAt),
    `${term.id}: مصدر وحالة تحقق لكل حدث`,
  )
  assert(term.events.every((event) => date(event.start) <= date(event.end)), `${term.id}: نطاقات الأحداث صحيحة`)
  if (study && exams) {
    assert(date(study.start) <= date(exams.start) && date(exams.end) <= date(study.end), `${term.id}: الاختبارات داخل نطاق الفصل`)
    assert(date(study.start) <= date(term.committeePlanStart) && date(term.committeePlanStart) < date(exams.start), `${term.id}: بداية أعمال اللجان داخل الفصل وقبل الاختبارات`)
    const workStart = new Date(date(term.committeePlanStart).getTime() + term.orientationDays * 86_400_000)
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
  console.log(`نجح التحقق: ${catalog.length} سجلًا مصدرية تختزل إلى ${taskTypes.length} مهمة موحدة، و11 نوع لجنة، و${guides.length} دليلًا.`)
  console.log(`إجمالي التأكيدات المنفذة: ${checks.length}`)
}
