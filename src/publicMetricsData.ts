export interface PublicMetricsRow {
  term: string
  department: string
  committee: string
  total: number
  completed: number
  inProgress: number
  delayed: number
  pending: number
  updatedAt: string
}

export const termCodes = ['461', '462', '471', '472', '481'] as const
export const currentTermCode = '481'

function normalizeTerm(value: string): string {
  return value.trim().replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

export const publicMetricsUrl = import.meta.env.VITE_PUBLIC_METRICS_CSV_URL?.trim() ?? ''

function parseCsv(input: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const csv = input.replace(/^\uFEFF/, '')
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index]
    if (char === '"') {
      if (quoted && csv[index + 1] === '"') { cell += '"'; index += 1 }
      else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell); cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && csv[index + 1] === '\n') index += 1
      row.push(cell); cell = ''
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
    } else cell += char
  }
  if (quoted) throw new Error('ملف المؤشرات غير مكتمل.')
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

const columns = ['القسم', 'اللجنة', 'إجمالي المهام', 'مكتمل', 'قيد التنفيذ', 'متعثر أو متأخر', 'لم يبدأ', 'تاريخ المعاينة']

export function parsePublicMetrics(csv: string): PublicMetricsRow[] {
  const [header, ...values] = parseCsv(csv)
  if (!header || columns.some((column, index) => header[index]?.trim() !== column)) {
    throw new Error('أعمدة ملف المؤشرات لا تطابق الصيغة المتوقعة.')
  }
  const hasTerm = header[8]?.trim() === 'الفصل'
  if (header.length > columns.length && !hasTerm) throw new Error('عمود الفصل في ملف المؤشرات غير صالح.')
  const rows = values.map((fields) => {
    if (fields.length < columns.length) throw new Error('أحد صفوف المؤشرات غير مكتمل.')
    if (fields.slice(2, 7).some((value) => !/^\d+$/.test(value.trim()))) {
      throw new Error('أحد أعداد المؤشرات غير صالح.')
    }
    const numbers = fields.slice(2, 7).map((value) => Number(value.trim()))
    if (numbers.some((value) => !Number.isSafeInteger(value) || value < 0)) {
      throw new Error('أحد أعداد المؤشرات غير صالح.')
    }
    const [total, completed, inProgress, delayed, pending] = numbers
    if (completed + inProgress + delayed + pending !== total) {
      throw new Error('مجموع حالات المهام لا يساوي إجماليها.')
    }
    const updatedAt = fields[7].trim()
    if (!/^\d{4}-\d{2}-\d{2}/.test(updatedAt)) throw new Error('تاريخ المؤشرات غير صالح.')
    // The original 41-row publication contains only the 481 task register.
    const term = hasTerm ? normalizeTerm(fields[8] ?? '') : currentTermCode
    if (!termCodes.some((code) => code === term)) throw new Error('رمز الفصل في ملف المؤشرات غير معروف.')
    return {
      term,
      department: fields[0].trim(), committee: fields[1].trim(),
      total, completed, inProgress, delayed, pending, updatedAt,
    }
  })
  const measures = ['total', 'completed', 'inProgress', 'delayed', 'pending'] as const
  for (const term of new Set(rows.map((row) => row.term))) {
    const termRows = rows.filter((row) => row.term === term)
    const keys = new Set(termRows.map((row) => `${row.department}\u0000${row.committee}`))
    if (keys.size !== termRows.length) throw new Error(`تكرار في مؤشرات الفصل ${term}.`)
    const all = termRows.find((row) => row.department === 'كل الأقسام' && row.committee === 'كل اللجان')
    const departments = termRows.filter((row) => row.department !== 'كل الأقسام' && row.committee === 'كل اللجان')
    if (!all || departments.length !== 4 || measures.some((measure) => departments.reduce((sum, row) => sum + row[measure], 0) !== all[measure])) {
      throw new Error(`ملخص الأقسام الأربعة للفصل ${term} غير مكتمل.`)
    }
    for (const department of departments) {
      const committees = termRows.filter((row) => row.department === department.department && row.committee !== 'كل اللجان')
      if (committees.length !== 9 || measures.some((measure) => committees.reduce((sum, row) => sum + row[measure], 0) !== department[measure])) {
        throw new Error(`مؤشرات لجان ${department.department} للفصل ${term} غير مكتملة.`)
      }
    }
  }
  return rows
}

export function metricsForTerm(rows: PublicMetricsRow[], term: string): PublicMetricsRow[] {
  if (term !== 'all') return rows.filter((row) => row.term === term)
  const byGroup = new Map<string, PublicMetricsRow>()
  for (const row of rows) {
    const key = `${row.department}\u0000${row.committee}`
    const found = byGroup.get(key)
    if (!found) byGroup.set(key, { ...row, term: 'all' })
    else {
      found.total += row.total
      found.completed += row.completed
      found.inProgress += row.inProgress
      found.delayed += row.delayed
      found.pending += row.pending
      if (row.updatedAt > found.updatedAt) found.updatedAt = row.updatedAt
    }
  }
  return [...byGroup.values()]
}

export async function loadPublicMetrics(): Promise<PublicMetricsRow[]> {
  if (!publicMetricsUrl) throw new Error('رابط مؤشرات Google Sheets غير مضبوط.')
  const response = await fetch(publicMetricsUrl, { cache: 'no-store' })
  if (!response.ok) throw new Error(`تعذّر تحميل مؤشرات اللجان (${response.status}).`)
  return parsePublicMetrics(await response.text())
}
