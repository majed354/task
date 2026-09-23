// Read the aggregate-only JSON snapshot from private Drive. Power Automate updates it from SharePoint.
const COURSE_REPORT_TERMS = ['٤٦١', '٤٦٢', '٤٧١', '٤٧٢']
const COURSE_REPORT_DEPARTMENTS = ['كل الأقسام', 'قسم الشريعة', 'قسم الأنظمة', 'قسم القراءات', 'قسم الثقافة الإسلامية']

function validateCourseReportRows(rows) {
    if (!Array.isArray(rows) || rows.length !== 20) throw new Error('Expected 20 aggregate rows')
    const seen = new Set()
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== 8) throw new Error('Invalid row width')
      const [term, department, sections, reports, measurements, courses, combined, checkedAt] = row
      if (!COURSE_REPORT_TERMS.includes(term) || !COURSE_REPORT_DEPARTMENTS.includes(department)) throw new Error('Invalid group')
      const key = term + ':' + department
      if (seen.has(key)) throw new Error('Duplicate group')
      seen.add(key)
      if (![sections, reports, measurements, courses, combined].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid count')
      if (reports > sections || measurements > sections || combined > courses) throw new Error('Count exceeds total')
      const date = new Date(checkedAt)
      if (Number.isNaN(date.getTime()) || date.getTime() > Date.now() + 5 * 60 * 1000 || Date.now() - date.getTime() > 3 * 60 * 60 * 1000) throw new Error('Invalid or stale scan time')
    }
    for (const term of COURSE_REPORT_TERMS) {
      const group = rows.filter((row) => row[0] === term)
      if (group.length !== 5) throw new Error('Incomplete term')
      const all = group.find((row) => row[1] === 'كل الأقسام')
      for (const field of [2, 3, 4]) {
        const sum = group.filter((row) => row[1] !== 'كل الأقسام').reduce((total, row) => total + row[field], 0)
        if (sum !== all[field]) throw new Error('Department totals differ')
      }
    }
}

function refreshCourseReportMetrics() {
  const settings = PropertiesService.getScriptProperties()
  const driveId = settings.getProperty('COURSE_REPORT_DRIVE_FILE_ID')
  const publicId = settings.getProperty('PUBLIC_SPREADSHEET_ID')
  if (!driveId || !publicId) throw new Error('Course-report Drive file or public workbook is not configured')
  const snapshot = DriveApp.getFileById(driveId)
  const sourceTime = snapshot.getLastUpdated()
  if (Number.isNaN(sourceTime.getTime()) || Date.now() - sourceTime.getTime() > 3 * 60 * 60 * 1000) {
    throw new Error('The SharePoint course-report snapshot has not synced recently')
  }
  const rows = JSON.parse(snapshot.getBlob().getDataAsString('UTF-8'))
  validateCourseReportRows(rows)
  const sheet = SpreadsheetApp.openById(publicId).getSheetByName('مؤشرات تقارير المقررات')
  if (!sheet) throw new Error('Course-report sheet is missing')
  const lock = LockService.getScriptLock()
  lock.waitLock(30000)
  try {
    sheet.getRange(2, 1, rows.length, 2).setNumberFormat('@')
    sheet.getRange(2, 8, rows.length, 1).setNumberFormat('@')
    sheet.getRange(2, 1, rows.length, 8).setValues(rows)
    SpreadsheetApp.flush()
  } finally {
    lock.releaseLock()
  }
}

function installHourlyCourseReportRefresh() {
  const name = 'refreshCourseReportMetrics'
  if (!ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === name)) {
    ScriptApp.newTrigger(name).timeBased().everyHours(1).create()
  }
}
