import assert from 'node:assert/strict'
import { adjustedCourseRows, eligibleSection, thesisReviewLabel, visibleThesisSignals } from '../src/thesisData.ts'

const make = (term, code, name, section, thesisDue = undefined) => ({ term, code, name, section, thesisDue,
  department: 'قسم الشريعة', member: 'عضو أول', report: 'غير مسلّم', measurement: false,
  combined: false, combinedMeasurement: false, done: 0, required: 4, unassignedPartial: 0, checkedAt: '2026-09-24T12:00:00+03:00' })
const ordinary = make('472', '100', 'مقرر عادي', '001')
const ongoing = make('472', '200', 'الرسالة', '001', false)
const completed = make('472', '200', 'الرسالة', '002', true)
const base = { term: '472', department: 'قسم الشريعة', sections: 3, reports: 0, measurements: 0, courses: 2, combined: 0,
  combinedWithMissingSections: 0, checkedAt: '2026-09-24T12:00:00+03:00', partialCovered: 0, partialReports: 0,
  unassignedPartial: 0, anyReport: 0, combinedMeasurements: 0 }
assert.equal(eligibleSection(ongoing), false)
assert.equal(eligibleSection(completed), true)
const [adjusted] = adjustedCourseRows([base], [ordinary, ongoing, completed])
assert.equal(adjusted.sections, 2)
assert.equal(adjusted.courses, 2)
const signals = [
  { department: 'قسم الشريعة', code: '200', member: 'عضو أول', terms: ['461', '462', '471'], lastTerm: '471', absentNextTerm: '472', sections: 1 },
  { department: 'قسم الشريعة', code: '201', member: 'عضو ثان', terms: ['461', '462'], lastTerm: '462', absentNextTerm: '471', sections: 1 },
]
assert.deepEqual(visibleThesisSignals(signals, '472', 'قسم الشريعة', '').map((row) => row.code), ['200'])
assert.match(thesisReviewLabel(signals[0]), /تحقق من التخرج/)
console.log('نجح اختبار استحقاق الرسائل وإشارة الانقطاع.')
