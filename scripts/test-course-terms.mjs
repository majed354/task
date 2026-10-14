import assert from 'node:assert/strict'
import { courseReportScope, matchesTermSelection } from '../src/courseTerms.ts'
import { visibleTheses, visibleThesisSignals } from '../src/thesisData.ts'

const fields = ['sections', 'reports', 'measurements', 'courses', 'combined', 'combinedWithMissingSections', 'partialCovered', 'partialReports', 'unassignedPartial', 'anyReport', 'combinedMeasurements']
const rows = ['461', '462', '471', '472'].flatMap((term, index) => ['كل الأقسام', 'قسم الشريعة'].map((department) => ({ term, department, checkedAt: `2026-09-${20 + index}T12:00:00Z`, ...Object.fromEntries(fields.map((field) => [field, index + 1])) })))
const original = structuredClone(rows)
assert.deepEqual(courseReportScope(rows, ['472']), courseReportScope(rows, '472'))
const two = courseReportScope(rows, ['471', '472'])
assert.equal(two.length, 2)
for (const row of two) for (const field of fields) assert.equal(row[field], 7, `${row.department}: ${field} must sum only the two selected terms`)
assert.equal(two[0].checkedAt, rows.at(-1).checkedAt)
assert.deepEqual(courseReportScope(rows, ['471', '472', '471']), two, 'Duplicate selection must not double counts')
assert.deepEqual(courseReportScope(rows, ['461', '462', '471', '472']), courseReportScope(rows, 'all'))
assert.deepEqual(courseReportScope(rows, []), [])
assert.deepEqual(rows, original, 'Aggregation must not modify source rows')
assert.equal(matchesTermSelection('461', ['471', '472']), false)
assert.equal(matchesTermSelection('472', ['471', '472']), true)

const entries = ['461', '471', '472'].map((term) => ({ term, department: 'قسم الشريعة', member: 'عضو أول', code: '200', section: '001', gradeDate: '', observedTerms: 1, basis: 'member' }))
assert.deepEqual(visibleTheses(entries, ['471', '472'], 'كل الأقسام', '').map((row) => row.term), ['471', '472'])
assert.equal(visibleTheses(entries, ['471', '472'], 'قسم الأنظمة', '').length, 0)
assert.equal(visibleTheses(entries, ['471', '472'], 'كل الأقسام', 'عضو ثان').length, 0)
const signals = [
  { department: 'قسم الشريعة', member: 'عضو أول', code: '200', terms: ['461', '462', '471'], lastTerm: '471', absentNextTerm: '472', sections: 1 },
  { department: 'قسم الأنظمة', member: 'عضو ثان', code: '201', terms: ['461'], lastTerm: '461', absentNextTerm: '462', sections: 1 },
]
assert.deepEqual(visibleThesisSignals(signals, ['471', '472'], 'كل الأقسام', '').map((row) => row.code), ['200'], 'A signal matching both selected terms appears once')
assert.equal(visibleThesisSignals(signals, ['471', '472'], 'قسم الأنظمة', '').length, 0)
assert.deepEqual(visibleThesisSignals(signals, '472', 'قسم الشريعة', ''), [signals[0]])
console.log('نجح جمع الفصول المحددة وتصفية الرسائل والإشارات دون تكرار أو تغيير بيانات المصدر.')
