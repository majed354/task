import assert from 'node:assert/strict'
import { buildCommitteeReview } from '../netlify/functions/lib/committeeReview.ts'
import { committeeChanges, committeeNewsForView, scopedCommitteeNews } from '../src/committeeNews.ts'
import { taskFolderUrl } from '../src/committeeTaskData.ts'

const task = { id: '1', term: '481', department: 'قسم القراءات', committee: 'لجنة الاختبارات والنتائج', title: 'متابعة الاختبارات', status: 'لم يبدأ', start: '2026-09-01', due: '2026-12-01', period: '', deliverable: '', evidence: '', folderUrl: '' }
task.folderUrl = taskFolderUrl(task)
const other = { ...task, id: '2', department: 'قسم الأنظمة' }
other.folderUrl = taskFolderUrl(other)
const old = { records: [task, other], checkedAt: '2026-11-20T09:00:00Z' }
const current = { records: [{ ...task, status: 'مكتمل' }, { ...other, status: 'قيد التنفيذ' }, { ...task, id: '3' }], checkedAt: '2026-11-23T09:00:00Z' }
const changes = committeeChanges(old, current)
assert.deepEqual(changes.map((item) => item.kind), ['completed', 'status', 'added'])
assert.equal(committeeChanges(null, current).length, 0, 'Initial import must not announce all scheduled tasks as additions')
assert.equal(committeeChanges(current, current).length, 0, 'Identical source time must not duplicate news')
assert.equal(committeeChanges(current, old).length, 0, 'Older snapshots must not create news')
assert.equal(committeeChanges(current, { ...current, checkedAt: '2026-11-24T09:00:00Z' }).length, 0)
const aliases = { ...current, checkedAt: '2026-11-24T09:00:00Z', records: current.records.map((row) => row.id === '1' ? { ...row, status: 'معتمد' } : row) }
assert.equal(committeeChanges(current, aliases).length, 0, 'Completion aliases must not announce duplicate achievements')
const reopened = { ...current, checkedAt: '2026-11-24T09:00:00Z', records: current.records.map((row) => row.id === '1' ? { ...row, status: 'قيد التنفيذ' } : row) }
assert.equal(committeeChanges(current, reopened)[0].kind, 'status')
const readings = current.records.filter((row) => row.department === 'قسم القراءات')
assert.equal(scopedCommitteeNews(changes, readings).length, 2)
assert.equal(scopedCommitteeNews([...changes, ...changes], readings).length, 2, 'Replayed news must not be shown twice')
assert.ok(scopedCommitteeNews(changes, readings).every((item) => item.department === 'قسم القراءات'))
assert.equal(scopedCommitteeNews([{ ...changes[0], department: 'قسم الأنظمة' }], readings).length, 0, 'News must match the authorized task department')
assert.equal(committeeNewsForView(changes, readings).length, 2, 'Existing dated achievements must not be repeated as baseline news')
const baseline = committeeNewsForView([], readings)
assert.equal(baseline.length, 1)
assert.equal(baseline[0].kind, 'recorded')
assert.equal(baseline[0].observedAt, '', 'Historical completion dates must not be fabricated')
assert.equal(committeeNewsForView(changes, []).length, 0)
console.log('Committee news: additions, completion, status changes, replay, initial import, historical dates and department isolation passed.')

const receipt = { taskId: task.id, term: task.term, reviewedAt: new Date().toISOString(), inputHash: 'a'.repeat(64), verdict: 'يحتاج استكمالًا', model: 'gemini-4-neon-medium', department: 'قسم آخر' }
assert.equal(buildCommitteeReview(receipt, old).department, task.department)
assert.equal(buildCommitteeReview(receipt, old).kind, 'review')
for (const patch of [{ taskId: 'missing' }, { term: '482' }, { inputHash: 'bad' }, { verdict: 'معتمد' }, { model: 'other' }, { reviewedAt: '2026-11-23' }]) {
  assert.throws(() => buildCommitteeReview({ ...receipt, ...patch }, old))
}
console.log('Review receipts: known tasks, server-derived scope, valid fingerprints and non-final verdicts passed.')
