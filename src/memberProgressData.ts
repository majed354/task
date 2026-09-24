import type { CourseDetailRow } from './courseReportData'

export interface MemberSummary {
  name: string
  sections: number
  courses: number
  reports: number
  independentReports: number
  partialReports: number
  measurements: number
  done: number
  required: number
  thesesUnderReview: number
}

export function summarizeMembers(rows: CourseDetailRow[]): MemberSummary[] {
  const found = new Map<string, MemberSummary & { courseKeys: Set<string> }>()
  for (const row of rows) {
    if (!row.member) continue
    const member = found.get(row.member) || { name: row.member, sections: 0, courses: 0, reports: 0, independentReports: 0, partialReports: 0, measurements: 0, done: 0, required: 0, thesesUnderReview: 0, courseKeys: new Set<string>() }
    if (row.name === 'الرسالة' && !row.thesisDue) {
      member.thesesUnderReview += 1
      found.set(row.member, member)
      continue
    }
    member.sections += 1
    member.independentReports += Number(row.report === 'مستقل')
    member.partialReports += Number(row.report === 'تغطية جماعية')
    member.reports += Number(row.report !== 'غير مسلّم')
    member.measurements += Number(row.measurement)
    member.courseKeys.add(`${row.term}:${row.code}`)
    found.set(row.member, member)
  }
  return [...found.values()].map(({ courseKeys, ...member }) => ({ ...member, courses: courseKeys.size, done: member.reports + member.measurements, required: member.sections * 2 }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}
