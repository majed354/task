import type { CourseReportRow } from './courseReportData'

export type TermSelection = string | readonly string[]

export function matchesTermSelection(term: string, selection: TermSelection): boolean {
  return typeof selection === 'string' ? selection === 'all' || selection === term : selection.includes(term)
}

export function courseReportScope(rows: CourseReportRow[], selection: TermSelection): CourseReportRow[] {
  const selected = rows.filter((row) => matchesTermSelection(row.term, selection))
  if (typeof selection === 'string' && selection !== 'all') return selected
  if (Array.isArray(selection) && selection.length === 1) return selected
  const aggregate = new Map<string, CourseReportRow>()
  for (const row of selected) {
    const found = aggregate.get(row.department)
    if (!found) aggregate.set(row.department, { ...row, term: 'all' })
    else {
      for (const field of ['sections', 'reports', 'measurements', 'courses', 'combined', 'combinedWithMissingSections', 'partialCovered', 'partialReports', 'unassignedPartial', 'anyReport', 'combinedMeasurements'] as const) found[field] += row[field]
      if (row.checkedAt > found.checkedAt) found.checkedAt = row.checkedAt
    }
  }
  return [...aggregate.values()]
}
