// Bound to the private workbook. Only aggregate rows are written to the public workbook.
const TIME_ZONE = 'Asia/Riyadh'
const DRIVE_SNAPSHOT_FILE_ID = '1GUhwFDsa6I53Qx6134R2WjTwvPNhWqQO'
const TERMS = ['٤٨١', '٤٦١', '٤٦٢', '٤٧١', '٤٧٢']

function normalizeTerm(value) {
  const raw = String(value ?? '').trim().replace(/[0-9]/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
  return raw || '٤٨١' // Existing 340 records predate the semester column.
}

function aggregateCommitteeMetrics(items, groups, today, updatedAt) {
  if (!Array.isArray(items) || items.length < 340) throw new Error('سجل SharePoint لم يُزامن كاملًا بعد.')
  if (!Array.isArray(groups) || groups.length !== 41) throw new Error('قائمة الأقسام واللجان غير مكتملة.')
  const seen = new Set()
  const result = new Map()
  for (const term of TERMS) groups.forEach(([department, committee]) => {
    const key = `${term}\u0000${department}\u0000${committee}`
    if (result.has(key)) throw new Error(`تكرار في مجموعة ${department} / ${committee}`)
    result.set(key, [0, 0, 0, 0, 0])
  })
  for (const item of items) {
    const id = String(item.i ?? '').trim()
    const department = String(item.d ?? '').trim()
    const committee = String(item.c ?? '').trim()
    const due = String(item.t ?? '').slice(0, 10)
    const status = String(item.s ?? '').trim()
    const term = normalizeTerm(item.f)
    if (!id || !department || !committee || !/^\d{4}-\d{2}-\d{2}$/.test(due) || !status) {
      throw new Error('سجل مهمة ناقص أو غير صالح.')
    }
    if (!TERMS.includes(term)) throw new Error(`فصل غير معروف للمهمة ${id}: ${term}`)
    if (seen.has(id)) throw new Error(`معرّف مهمة مكرر: ${id}`)
    seen.add(id)
    const completed = ['مكتمل', 'منجز', 'معتمد'].includes(status)
    const delayed = status === 'متعثر' || (due < today && !completed)
    const inProgress = status === 'قيد التنفيذ' && !delayed
    const measure = completed ? 1 : inProgress ? 2 : delayed ? 3 : 4
    for (const key of [`${term}\u0000كل الأقسام\u0000كل اللجان`, `${term}\u0000${department}\u0000كل اللجان`, `${term}\u0000${department}\u0000${committee}`]) {
      const counts = result.get(key)
      if (!counts) throw new Error(`القسم أو اللجنة غير موجودة في جدول المؤشرات: ${key}`)
      counts[0] += 1
      counts[measure] += 1
    }
  }
  return TERMS.flatMap((term) => groups.map(([department, committee]) => {
    const counts = result.get(`${term}\u0000${department}\u0000${committee}`)
    return [department, committee, ...counts, updatedAt, term]
  }))
}

function refreshCommitteeMetrics() {
  const settings = PropertiesService.getScriptProperties()
  const publicId = settings.getProperty('PUBLIC_SPREADSHEET_ID')
  if (!publicId) throw new Error('معرّف جدول المؤشرات غير مضبوط في خصائص النص البرمجي.')
  const snapshot = DriveApp.getFileById(DRIVE_SNAPSHOT_FILE_ID)
  const publicSheet = SpreadsheetApp.openById(publicId).getSheetByName('مؤشرات اللجان')
  if (!publicSheet) throw new Error('تعذّر العثور على ورقة المؤشرات.')
  const sourceTime = snapshot.getLastUpdated()
  if (Number.isNaN(sourceTime.getTime()) || Date.now() - sourceTime.getTime() > 3 * 60 * 60 * 1000) {
    throw new Error('انقطعت مزامنة SharePoint أو لم تُشغّل بعد.')
  }
  const items = JSON.parse(snapshot.getBlob().getDataAsString('UTF-8'))
  const groups = publicSheet.getRange(2, 1, 41, 2).getValues()
  const now = new Date()
  const today = Utilities.formatDate(now, TIME_ZONE, 'yyyy-MM-dd')
  const updatedAt = Utilities.formatDate(sourceTime, TIME_ZONE, "yyyy-MM-dd'T'HH:mm:ss")
  const values = aggregateCommitteeMetrics(items, groups, today, updatedAt)
  publicSheet.getRange(1, 9).setValue('الفصل')
  publicSheet.getRange(2, 8, values.length, 1).setNumberFormat('@')
  publicSheet.getRange(2, 1, values.length, 9).setValues(values)
  SpreadsheetApp.flush()
}

function installHourlyRefresh() {
  const exists = ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === 'refreshCommitteeMetrics')
  if (!exists) ScriptApp.newTrigger('refreshCommitteeMetrics').timeBased().everyHours(1).create()
}
