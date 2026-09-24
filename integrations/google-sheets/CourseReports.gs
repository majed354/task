// SharePoint -> private Drive JSON -> public course-report sheets with assigned faculty names.
const COURSE_REPORT_TERMS = ['٤٦١', '٤٦٢', '٤٧١', '٤٧٢']
const COURSE_REPORT_DEPARTMENTS = ['كل الأقسام', 'قسم الشريعة', 'قسم الأنظمة', 'قسم القراءات', 'قسم الثقافة الإسلامية']
const COURSE_AGGREGATE_HEADER = ['الفصل', 'القسم', 'الشعب', 'تقارير الشعب المسلمة', 'قياسات المخرجات المسلمة', 'المقررات', 'التقارير المجمعة المسلمة', 'المجمعة مع نقص تقارير الشعب', 'وقت الفحص', 'الشعب المغطاة بتقرير جزئي', 'التقارير الجزئية المسلمة', 'تقارير جزئية بانتظار الإسناد', 'الشعب ذات أي تقرير', 'قياسات المخرجات المجمعة المسلمة']
const COURSE_DETAIL_HEADER = ['الفصل', 'رمز المقرر', 'اسم المقرر', 'القسم', 'الشعبة التنظيمية', 'حالة تقرير الشعبة', 'قياس مخرجات الشعبة', 'التقرير المجمع', 'القياس المجمع', 'المتطلبات المنجزة', 'إجمالي المتطلبات', 'تقارير جزئية بانتظار الإسناد', 'وقت الفحص', 'عضو هيئة التدريس']

function assertCourseCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid count: ' + label)
}

function assertCourseTime(value) {
  const time = new Date(value).getTime()
  if (!Number.isFinite(time) || time > Date.now() + 5 * 60 * 1000 || Date.now() - time > 3 * 60 * 60 * 1000) throw new Error('Invalid or stale scan time')
}

function validateCourseReportSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.aggregateRows) || !Array.isArray(snapshot.courseRows)) throw new Error('Invalid course-report snapshot')
  const rows = snapshot.aggregateRows
  const details = snapshot.courseRows
  if (rows.length !== 20 || details.length === 0) throw new Error('Incomplete course-report snapshot')
  const seen = new Set()
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== COURSE_AGGREGATE_HEADER.length) throw new Error('Invalid aggregate row width')
    const [term, department, sections, reports, measurements, courses, combined, missing, checkedAt, partialCovered, partialReports, pending, anyReport, combinedClo] = row
    if (!COURSE_REPORT_TERMS.includes(term) || !COURSE_REPORT_DEPARTMENTS.includes(department)) throw new Error('Invalid aggregate group')
    const key = term + ':' + department
    if (seen.has(key)) throw new Error('Duplicate aggregate group')
    seen.add(key)
    for (const value of [sections, reports, measurements, courses, combined, missing, partialCovered, partialReports, pending, anyReport, combinedClo]) assertCourseCount(value, key)
    if (reports > sections || measurements > sections || partialCovered > sections || anyReport > sections || anyReport < reports || combined > courses || combinedClo > courses || missing > combined || pending > partialReports) throw new Error('Aggregate count exceeds total')
    assertCourseTime(checkedAt)
  }
  for (const term of COURSE_REPORT_TERMS) {
    const group = rows.filter(row => row[0] === term)
    if (group.length !== 5) throw new Error('Incomplete term: ' + term)
    const all = group.find(row => row[1] === 'كل الأقسام')
    for (const field of [2, 3, 4, 9, 10, 11, 12]) {
      const sum = group.filter(row => row[1] !== 'كل الأقسام').reduce((total, row) => total + row[field], 0)
      if (sum !== all[field]) throw new Error('Department totals differ: ' + term + ':' + field)
    }
  }
  const courses = new Map()
  const sectionKeys = new Set()
  const totals = new Map()
  for (const row of details) {
    if (!Array.isArray(row) || row.length !== COURSE_DETAIL_HEADER.length) throw new Error('Invalid course detail row width')
    const [term, code, name, department, section, report, clo, combined, combinedClo, done, required, pending, checkedAt, member] = row
    if (!COURSE_REPORT_TERMS.includes(term) || !/^[0-9]+$/.test(String(code)) || !String(name).trim() || !COURSE_REPORT_DEPARTMENTS.slice(1).includes(department) || !/^\d{3}$/.test(String(section)) || !['مستقل', 'تغطية جماعية', 'غير مسلّم'].includes(report) || typeof member !== 'string' || !member.trim()) throw new Error('Invalid course detail identifier')
    for (const flag of [clo, combined, combinedClo]) if (flag !== 0 && flag !== 1) throw new Error('Invalid course detail flag')
    for (const value of [done, required, pending]) assertCourseCount(value, 'course detail')
    if (done > required || required < 2) throw new Error('Invalid course progress')
    assertCourseTime(checkedAt)
    const sectionKey = [term, code, department, section].join(':')
    if (sectionKeys.has(sectionKey)) throw new Error('Duplicate course section')
    sectionKeys.add(sectionKey)
    const courseKey = term + ':' + code
    const item = courses.get(courseKey) || { rows: [], done, required, combined, combinedClo, pending }
    if (item.done !== done || item.required !== required || item.combined !== combined || item.combinedClo !== combinedClo || item.pending !== pending) throw new Error('Inconsistent course progress')
    item.rows.push(row)
    courses.set(courseKey, item)
    const group = totals.get(term) || { sections: 0, reports: 0, measurements: 0, any: 0 }
    group.sections += 1
    group.reports += Number(report === 'مستقل')
    group.measurements += clo
    group.any += Number(report !== 'غير مسلّم')
    totals.set(term, group)
  }
  for (const [key, item] of courses) {
    const n = item.rows.length
    const expectedRequired = n === 1 ? 2 : 2 * n + 2
    const covered = item.rows.filter(row => row[5] !== 'غير مسلّم').length
    const measured = item.rows.filter(row => row[6] === 1).length
    const expectedDone = n === 1 ? Number(covered > 0 || item.combined === 1) + Number(measured > 0 || item.combinedClo === 1) : covered + measured + item.combined + item.combinedClo
    if (item.required !== expectedRequired || item.done !== expectedDone) throw new Error('Course progress mismatch: ' + key)
  }
  for (const term of COURSE_REPORT_TERMS) {
    const all = rows.find(row => row[0] === term && row[1] === 'كل الأقسام')
    const actual = totals.get(term)
    if (!actual || [actual.sections, actual.reports, actual.measurements, actual.any].some((value, index) => value !== all[[2, 3, 4, 12][index]]) || [...courses.keys()].filter(key => key.startsWith(term + ':')).length !== all[5]) throw new Error('Course details do not reconcile with totals: ' + term)
  }
}

function refreshCourseReportMetrics() {
  const settings = PropertiesService.getScriptProperties()
  const driveId = settings.getProperty('COURSE_REPORT_DRIVE_FILE_ID')
  const publicId = settings.getProperty('PUBLIC_SPREADSHEET_ID')
  if (!driveId || !publicId) throw new Error('Course-report Drive file or public workbook is not configured')
  const source = DriveApp.getFileById(driveId)
  if (Date.now() - source.getLastUpdated().getTime() > 3 * 60 * 60 * 1000) throw new Error('The SharePoint course-report snapshot has not synced recently')
  const snapshot = JSON.parse(source.getBlob().getDataAsString('UTF-8'))
  // During rollout, keep the existing sheets intact until Power Automate receives the new object.
  if (Array.isArray(snapshot)) return
  validateCourseReportSnapshot(snapshot)
  const book = SpreadsheetApp.openById(publicId)
  const aggregate = book.getSheetByName('مؤشرات تقارير المقررات')
  if (!aggregate) throw new Error('Course-report aggregate sheet is missing')
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    const detail = book.getSheetByName('تفاصيل تقارير المقررات') || book.insertSheet('تفاصيل تقارير المقررات')
    for (const [sheet, header, rows] of [[aggregate, COURSE_AGGREGATE_HEADER, snapshot.aggregateRows], [detail, COURSE_DETAIL_HEADER, snapshot.courseRows]]) {
      const needed = rows.length + 1
      if (sheet.getMaxRows() < needed) sheet.insertRowsAfter(sheet.getMaxRows(), needed - sheet.getMaxRows())
      if (sheet.getMaxColumns() < header.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), header.length - sheet.getMaxColumns())
      // Format identifiers as text before setValues; Sheets otherwise drops Arabic
      // digit shaping and leading zeroes from organizational section numbers.
      if (sheet === aggregate) {
        sheet.getRange(2, 1, rows.length, 2).setNumberFormat('@')
        sheet.getRange(2, 9, rows.length, 1).setNumberFormat('@')
      } else {
        sheet.getRange(2, 1, rows.length, 2).setNumberFormat('@')
        sheet.getRange(2, 5, rows.length, 1).setNumberFormat('@')
        sheet.getRange(2, 13, rows.length, 1).setNumberFormat('@')
      }
      sheet.getRange(1, 1, 1, header.length).setValues([header])
      sheet.getRange(2, 1, rows.length, header.length).setValues(rows)
      if (sheet.getLastRow() > needed) sheet.getRange(needed + 1, 1, sheet.getLastRow() - needed, header.length).clearContent()
      sheet.setFrozenRows(1)
    }
    SpreadsheetApp.flush()
  } finally {
    lock.releaseLock()
  }
}

function installHourlyCourseReportRefresh() {
  const name = 'refreshCourseReportMetrics'
  if (!ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === name)) ScriptApp.newTrigger(name).timeBased().everyHours(1).create()
}
