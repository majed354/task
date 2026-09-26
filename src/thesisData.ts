import type { CourseDetailRow, CourseReportRow, ThesisEntry, ThesisSignal } from './courseReportData'

export const eligibleSection = (row: CourseDetailRow) => row.name !== 'الرسالة' || row.thesisDue === true

export function adjustedCourseRows(aggregates: CourseReportRow[], sections: CourseDetailRow[]): CourseReportRow[] {
  return aggregates.map((original) => {
    const relevant = sections.filter((row) => row.term === original.term && (original.department === 'كل الأقسام' || row.department === original.department))
    const eligible = relevant.filter(eligibleSection)
    const courses = new Map<string, CourseDetailRow[]>()
    for (const row of eligible) courses.set(row.code, [...(courses.get(row.code) || []), row])
    const groups = [...courses.values()]
    return {
      ...original,
      sections: eligible.length,
      reports: eligible.filter((row) => row.report === 'مستقل').length,
      measurements: eligible.filter((row) => row.measurement).length,
      courses: groups.length,
      combined: groups.filter((group) => group[0].combined).length,
      combinedWithMissingSections: groups.filter((group) => group[0].combined && group.some((row) => row.report === 'غير مسلّم')).length,
      partialCovered: eligible.filter((row) => row.report === 'تغطية جماعية').length,
      unassignedPartial: groups.reduce((sum, group) => sum + group[0].unassignedPartial, 0),
      anyReport: eligible.filter((row) => row.report !== 'غير مسلّم').length,
      combinedMeasurements: groups.filter((group) => group[0].combinedMeasurement).length,
    }
  })
}

export function thesisReviewLabel(signal: ThesisSignal): string {
  if (signal.absentNextTerm && signal.terms.length >= 3) return 'انقطع بعد ٣ فصول أو أكثر — تحقق من التخرج'
  if (signal.absentNextTerm) return 'انقطع من جدول الفصل التالي — تحقق من السبب'
  if (signal.terms.length >= 4) return '٤ فصول — أولوية للمراجعة'
  if (signal.terms.length === 3) return '٣ فصول — احتمال اكتمال'
  if (signal.terms.length === 2) return 'فصلان — غالبًا مستمرة'
  return 'ظهور أول — قيد المتابعة'
}

export function visibleTheses(entries: ThesisEntry[], term: string, department: string, member: string): ThesisEntry[] {
  return entries.filter((row) => (term === 'all' || row.term === term) && (department === 'كل الأقسام' || row.department === department) && (!member || row.member === member))
}

export function visibleThesisSignals(signals: ThesisSignal[], term: string, department: string, member: string): ThesisSignal[] {
  return signals.filter((row) => (term === 'all' || row.lastTerm === term || row.absentNextTerm === term) && (department === 'كل الأقسام' || row.department === department) && (!member || row.member === member))
    .sort((a, b) => Number(Boolean(b.absentNextTerm)) - Number(Boolean(a.absentNextTerm)) || b.terms.length - a.terms.length || a.member.localeCompare(b.member, 'ar'))
}
