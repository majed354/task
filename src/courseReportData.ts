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
}

export const courseReportTerms = ['461', '462', '471', '472'] as const
export const currentCourseReportTerm = '472'
export const courseReportSheet = 'https://docs.google.com/spreadsheets/d/1yJTkplb3IyP89RK-zv-AK42NOuk_C_4u8bTiPyz6Qhk/edit?gid=1497658740#gid=1497658740'
const publishedCsv = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vROMId3BOGaEpK7sEOITC3CIs0HLsuGbmbDdcW4OpUPsNRAuAz9lBtr1CY98hsYAp5tAcwQh401ERfJ/pub?gid=1497658740&single=true&output=csv'
const departments = ['كل الأقسام', 'قسم الشريعة', 'قسم الأنظمة', 'قسم القراءات', 'قسم الثقافة الإسلامية']
const header = ['الفصل', 'القسم', 'الشعب', 'تقارير الشعب المسلمة', 'قياسات المخرجات المسلمة', 'المقررات', 'التقارير المجمعة المسلمة', 'المجمعة مع نقص تقارير الشعب', 'وقت الفحص']

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

export function parseCourseReportCsv(csv: string): CourseReportRow[] {
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
    const counts = fields.slice(2, 8).map((field) => Number(westernDigits(field.trim())))
    if (fields.slice(2, 8).some((field) => !/^\d+$/.test(westernDigits(field.trim()))) || counts.some((count) => !Number.isSafeInteger(count))) {
      throw new Error('أحد أعداد تقارير المقررات غير صالح.')
    }
    const [sections, reports, measurements, courses, combined, combinedWithMissingSections] = counts
    if (reports > sections || measurements > sections || combined > courses || combinedWithMissingSections > combined) {
      throw new Error('تجاوزت التسليمات العدد المتوقع في مؤشرات التقارير.')
    }
    const checkedAt = fields[8].trim()
    if (!Number.isFinite(Date.parse(checkedAt))) throw new Error('وقت فحص تقارير المقررات غير صالح.')
    return { term, department, sections, reports, measurements, courses, combined, combinedWithMissingSections, checkedAt }
  })
  for (const term of courseReportTerms) {
    const termRows = rows.filter((row) => row.term === term)
    if (termRows.length !== departments.length || new Set(termRows.map((row) => row.department)).size !== departments.length) {
      throw new Error(`مؤشرات الأقسام للفصل ${term} غير مكتملة.`)
    }
    const overall = termRows.find((row) => row.department === 'كل الأقسام')!
    for (const field of ['sections', 'reports', 'measurements'] as const) {
      if (termRows.filter((row) => row.department !== 'كل الأقسام').reduce((sum, row) => sum + row[field], 0) !== overall[field]) {
        throw new Error(`إجمالي ${field} للفصل ${term} لا يطابق الأقسام.`)
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
      if (row.checkedAt > found.checkedAt) found.checkedAt = row.checkedAt
    }
  }
  return [...aggregate.values()]
}

export async function loadCourseReports(): Promise<CourseReportRow[]> {
  const response = await fetch(publishedCsv, { cache: 'no-store' })
  if (!response.ok) throw new Error(`تعذّر تحميل ورقة تقارير المقررات (${response.status}).`)
  return parseCourseReportCsv(await response.text())
}
