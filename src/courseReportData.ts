export interface CourseReportRow {
  term: string
  department: string
  sections: number
  reports: number
  measurements: number
  courses: number
  combined: number
  combinedWithMissingSections: number
  checkedAt: string
  partialCovered: number
  partialReports: number
  unassignedPartial: number
  anyReport: number
  combinedMeasurements: number
}

export interface CourseDetailRow {
  term: string
  code: string
  name: string
  department: string
  section: string
  member: string
  report: 'مستقل' | 'تغطية جماعية' | 'غير مسلّم'
  measurement: boolean
  combined: boolean
  combinedMeasurement: boolean
  done: number
  required: number
  unassignedPartial: number
  checkedAt: string
}

export const courseReportTerms = ['461', '462', '471', '472'] as const
export const currentCourseReportTerm = '472'
const departments = ['كل الأقسام', 'قسم الشريعة', 'قسم الأنظمة', 'قسم القراءات', 'قسم الثقافة الإسلامية']
const header = ['الفصل', 'القسم', 'الشعب', 'تقارير الشعب المسلمة', 'قياسات المخرجات المسلمة', 'المقررات', 'التقارير المجمعة المسلمة', 'المجمعة مع نقص تقارير الشعب', 'وقت الفحص', 'الشعب المغطاة بتقرير جزئي', 'التقارير الجزئية المسلمة', 'تقارير جزئية بانتظار الإسناد', 'الشعب ذات أي تقرير', 'قياسات المخرجات المجمعة المسلمة']
const detailHeader = ['الفصل', 'رمز المقرر', 'اسم المقرر', 'القسم', 'الشعبة التنظيمية', 'حالة تقرير الشعبة', 'قياس مخرجات الشعبة', 'التقرير المجمع', 'القياس المجمع', 'المتطلبات المنجزة', 'إجمالي المتطلبات', 'تقارير جزئية بانتظار الإسناد', 'وقت الفحص', 'عضو هيئة التدريس']

export type CourseAccessScope = 'all' | 'قسم الشريعة' | 'قسم الأنظمة' | 'قسم القراءات' | 'قسم الثقافة الإسلامية'

export class CourseAccessError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

function westernDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

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
  if (quoted) throw new Error('ملف مؤشرات التقارير غير مكتمل.')
  row.push(cell)
  if (row.some((value) => value.trim())) rows.push(row)
  return rows
}

export function parseCourseReportCsv(csv: string, scope: CourseAccessScope = 'all'): CourseReportRow[] {
  const [columns, ...values] = parseCsv(csv)
  if (!columns || columns.length !== header.length || header.some((name, index) => columns[index]?.trim() !== name)) {
    throw new Error('أعمدة ورقة تقارير المقررات لا تطابق الصيغة المطلوبة.')
  }
  const rows = values.map((fields) => {
    if (fields.length !== header.length) throw new Error('أحد صفوف مؤشرات التقارير غير مكتمل.')
    const term = westernDigits(fields[0].trim())
    const department = fields[1].trim()
    if (!courseReportTerms.some((code) => code === term) || !departments.includes(department)) {
      throw new Error('الفصل أو القسم في مؤشرات التقارير غير معروف.')
    }
    const countFields = [...fields.slice(2, 8), ...fields.slice(9, 14)]
    const counts = countFields.map((field) => Number(westernDigits(field.trim())))
    if (countFields.some((field) => !/^\d+$/.test(westernDigits(field.trim()))) || counts.some((count) => !Number.isSafeInteger(count))) {
      throw new Error('أحد أعداد تقارير المقررات غير صالح.')
    }
    const [sections, reports, measurements, courses, combined, combinedWithMissingSections, partialCovered, partialReports, unassignedPartial, anyReport, combinedMeasurements] = counts
    if (reports > sections || measurements > sections || partialCovered > sections || anyReport > sections || anyReport < reports || combined > courses || combinedMeasurements > courses || combinedWithMissingSections > combined || unassignedPartial > partialReports) {
      throw new Error('تجاوزت التسليمات العدد المتوقع في مؤشرات التقارير.')
    }
    const checkedAt = fields[8].trim()
    if (!Number.isFinite(Date.parse(checkedAt))) throw new Error('وقت فحص تقارير المقررات غير صالح.')
    return { term, department, sections, reports, measurements, courses, combined, combinedWithMissingSections, checkedAt, partialCovered, partialReports, unassignedPartial, anyReport, combinedMeasurements }
  })
  for (const term of courseReportTerms) {
    const termRows = rows.filter((row) => row.term === term)
    const expected = scope === 'all' ? departments : [scope]
    if (termRows.length !== expected.length || expected.some((department) => !termRows.some((row) => row.department === department))) {
      throw new Error(`مؤشرات الأقسام للفصل ${term} غير مكتملة.`)
    }
    if (scope === 'all') {
      const overall = termRows.find((row) => row.department === 'كل الأقسام')!
      for (const field of ['sections', 'reports', 'measurements', 'partialCovered', 'partialReports', 'unassignedPartial', 'anyReport'] as const) {
        if (termRows.filter((row) => row.department !== 'كل الأقسام').reduce((sum, row) => sum + row[field], 0) !== overall[field]) {
          throw new Error(`إجمالي ${field} للفصل ${term} لا يطابق الأقسام.`)
        }
      }
    }
  }
  return rows
}

export function courseReportScope(rows: CourseReportRow[], term: string): CourseReportRow[] {
  if (term !== 'all') return rows.filter((row) => row.term === term)
  const aggregate = new Map<string, CourseReportRow>()
  for (const row of rows) {
    const found = aggregate.get(row.department)
    if (!found) aggregate.set(row.department, { ...row, term: 'all' })
    else {
      found.sections += row.sections
      found.reports += row.reports
      found.measurements += row.measurements
      found.courses += row.courses
      found.combined += row.combined
      found.combinedWithMissingSections += row.combinedWithMissingSections
      found.partialCovered += row.partialCovered
      found.partialReports += row.partialReports
      found.unassignedPartial += row.unassignedPartial
      found.anyReport += row.anyReport
      found.combinedMeasurements += row.combinedMeasurements
      if (row.checkedAt > found.checkedAt) found.checkedAt = row.checkedAt
    }
  }
  return [...aggregate.values()]
}

export function parseCourseDetailCsv(csv: string): CourseDetailRow[] {
  const [columns, ...values] = parseCsv(csv)
  const hasMembers = columns?.length === detailHeader.length
  if (!columns || (columns.length !== detailHeader.length && columns.length !== detailHeader.length - 1) || detailHeader.slice(0, columns.length).some((name, index) => columns[index]?.trim() !== name)) throw new Error('أعمدة تفاصيل تقارير المقررات لا تطابق الصيغة المطلوبة.')
  const seen = new Set<string>()
  return values.map((fields) => {
    if (fields.length !== columns.length) throw new Error('أحد صفوف تفاصيل المقررات غير مكتمل.')
    const term = westernDigits(fields[0].trim())
    const code = westernDigits(fields[1].trim())
    const name = fields[2].trim()
    const department = fields[3].trim()
    const section = westernDigits(fields[4].trim()).padStart(3, '0')
    const report = fields[5].trim() as CourseDetailRow['report']
    const numbers = fields.slice(6, 12).map((value) => Number(westernDigits(value.trim())))
    if (!courseReportTerms.some((value) => value === term) || !/^\d+$/.test(code) || !name || !departments.slice(1).includes(department) || !/^\d{3}$/.test(section) || !['مستقل', 'تغطية جماعية', 'غير مسلّم'].includes(report) || fields.slice(6, 12).some((value) => !/^\d+$/.test(westernDigits(value.trim()))) || numbers.some((value) => !Number.isSafeInteger(value))) throw new Error('تفاصيل المقرر أو الشعبة غير صالحة.')
    const [measurement, combined, combinedMeasurement, done, required, unassignedPartial] = numbers
    const member = hasMembers ? fields[13].trim().replace(/\s+/g, ' ') : ''
    if ([measurement, combined, combinedMeasurement].some((value) => value > 1) || done > required || required < 2 || !Number.isFinite(Date.parse(fields[12])) || (hasMembers && !member)) throw new Error('حالة إنجاز المقرر غير صالحة.')
    const key = [term, code, department, section].join(':')
    if (seen.has(key)) throw new Error('شعبة مكررة في ورقة التفاصيل.')
    seen.add(key)
    return { term, code, name, department, section, member, report, measurement: measurement === 1, combined: combined === 1, combinedMeasurement: combinedMeasurement === 1, done, required, unassignedPartial, checkedAt: fields[12].trim() }
  })
}

function asCsv(rows: Array<Array<string | number>>): string {
  return rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export async function loadCourseSnapshot(): Promise<{ scope: CourseAccessScope; aggregates: CourseReportRow[]; sections: CourseDetailRow[] }> {
  const response = await fetch('/api/course/data', { cache: 'no-store', credentials: 'same-origin' })
  if (!response.ok) throw new CourseAccessError(response.status, response.status === 401 ? 'يلزم إدخال كلمة المرور.' : `تعذّر تحميل بيانات التقارير (${response.status}).`)
  const payload = await response.json() as { scope?: CourseAccessScope; aggregateRows?: Array<Array<string | number>>; courseRows?: Array<Array<string | number>> }
  if (!payload.scope || !['all', ...departments.slice(1)].includes(payload.scope) || !Array.isArray(payload.aggregateRows) || !Array.isArray(payload.courseRows)) throw new Error('بيانات التقارير المحمية غير مكتملة.')
  return {
    scope: payload.scope,
    aggregates: parseCourseReportCsv(asCsv([header, ...payload.aggregateRows]), payload.scope),
    sections: parseCourseDetailCsv(asCsv([detailHeader, ...payload.courseRows])),
  }
}
