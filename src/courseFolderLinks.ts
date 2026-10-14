export interface CourseFolderLinks {
  term: string
  code: string
  department: string
  section: string
  report: string
  measurement: string
  combined: string
  combinedMeasurement: string
}

export const courseSectionKey = (row: { term: string; code: string; department: string; section: string }) => [row.term, row.code, row.department, row.section].join(':')

export function isCourseFolderPath(value: unknown): value is string {
  return typeof value === 'string' && /^1-التقارير\/٤[٦٧][١٢]\/.+/.test(value)
    && !value.split('/').some((part) => part === '..' || part === '.' || !part)
    && !/[\\\u0000-\u001f]/.test(value)
}

export function courseFolderUrl(path: string): string {
  if (!isCourseFolderPath(path)) return ''
  const root = '/sites/msteams_3b4354/Shared Documents/متابعة تقارير المقررات/'
  return `https://taifedusa.sharepoint.com/sites/msteams_3b4354/Shared%20Documents/Forms/AllItems.aspx?id=${encodeURIComponent(root + path)}`
}
