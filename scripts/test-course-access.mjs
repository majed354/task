import assert from 'node:assert/strict'
import { normalizePassword, scopedSnapshot } from '../netlify/functions/course.ts'

const sharia = 'قسم الشريعة'
const systems = 'قسم الأنظمة'
const report = (department, section, delivered) => ['٤٧٢', '2001001', 'مقرر مشترك', department, section, delivered ? 'مستقل' : 'غير مسلّم', 0, 0, 0, 1, 8, 0, '2026-09-24T10:00:00Z', `عضو ${department}`]
const snapshot = {
  aggregateRows: [['٤٧٢', sharia, 2], ['٤٧٢', systems, 1]],
  courseRows: [report(sharia, '001', true), report(sharia, '002', false), report(systems, '003', false)],
}

const own = scopedSnapshot(snapshot, sharia)
assert.equal(own.aggregateRows.length, 1)
assert.equal(own.courseRows.length, 2)
assert.ok(own.courseRows.every((row) => row[3] === sharia && !String(row[13]).includes(systems)))
assert.ok(own.courseRows.every((row) => row[9] === 1 && row[10] === 6))

const other = scopedSnapshot(snapshot, systems)
assert.equal(other.courseRows.length, 1)
assert.equal(other.courseRows[0][9], 0)
assert.equal(other.courseRows[0][10], 2)
assert.equal(scopedSnapshot(snapshot, 'all').courseRows.length, 3)
assert.equal(snapshot.courseRows[0][10], 8, 'Filtering must not modify the stored source')
assert.equal(normalizePassword('m٤٨٢٧'), 'M4827')
assert.equal(normalizePassword('m۴۸۲۷'), 'M4827')
assert.equal(normalizePassword('M4827'), 'M4827')

console.log('نجح اختبار عزل بيانات الأقسام وإعادة احتساب المقرر المشترك.')
