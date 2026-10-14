import assert from 'node:assert/strict'
import catalog from '../netlify/functions/lib/committeeCatalog.json' with { type: 'json' }
import { buildCommitteeSnapshot, scopedCommitteeSnapshot } from '../netlify/functions/lib/committeeSnapshot.ts'
import { isTaskFolderUrl, taskFolderUrl, taskState, tasksForView } from '../src/committeeTaskData.ts'
import course from '../netlify/functions/course.ts'
import { createHmac } from 'node:crypto'

const source = { checkedAt: new Date().toISOString(), items: catalog.map((task) => ({ i: task.id, d: task.department, c: task.committee, t: '2027-02-01', f: '٤٨١', s: 'لم يبدأ' })) }
const snapshot = buildCommitteeSnapshot(source)
assert.equal(snapshot.records.length, 340)
for (const department of new Set(catalog.map((task) => task.department))) {
  const scoped = scopedCommitteeSnapshot(snapshot, department)
  assert.equal(scoped.records.length, 85)
  assert.ok(scoped.records.every((task) => task.department === department && isTaskFolderUrl(task)))
  assert.ok(scoped.records.every((task) => new URL(task.folderUrl).searchParams.get('id').includes(`/${department}/`)))
}
assert.equal(scopedCommitteeSnapshot(snapshot, 'all').records.length, 340)
assert.equal(snapshot.records.length, 340)
assert.throws(() => buildCommitteeSnapshot({ ...source, items: source.items.slice(1) }))
assert.throws(() => buildCommitteeSnapshot({ ...source, items: [...source.items, source.items[0]] }))
assert.throws(() => buildCommitteeSnapshot({ ...source, items: source.items.map((item, index) => index ? item : { ...item, u: 'https://example.com' }) }))
assert.throws(() => buildCommitteeSnapshot({ ...source, items: source.items.map((item, index) => index ? item : { ...item, d: 'قسم آخر' }) }))
assert.throws(() => buildCommitteeSnapshot({ ...source, items: source.items.map((item, index) => index ? item : { ...item, h: '../ملفات' }) }))
assert.throws(() => buildCommitteeSnapshot({ ...source, checkedAt: '2026-10-06T12:00:00' }))
const task = snapshot.records[0]
const cases = [
  { ...task, id: 'completed', start: '2026-09-01', due: '2026-09-10', status: 'مكتمل' },
  { ...task, id: 'upcoming', start: '2026-11-01', due: '2026-12-01' },
  { ...task, id: 'delayed', start: '2026-09-01', due: '2026-09-10' },
  { ...task, id: 'active', start: '2026-09-01', due: '2026-10-20', status: 'قيد التنفيذ' },
  { ...task, id: 'due-today', start: '2026-09-01', due: '2026-10-06' },
]
assert.deepEqual(tasksForView(cases, 'actionable', '2026-10-06').map((row) => row.id), ['delayed', 'active', 'due-today'])
assert.equal(taskState(cases[0], '2026-10-06'), 'completed')
assert.equal(taskState(cases[4], '2026-10-06'), 'pending')
assert.deepEqual(tasksForView(cases, 'upcoming', '2026-10-06').map((row) => row.id), ['upcoming'])
assert.deepEqual(tasksForView(cases, 'completed', '2026-10-06').map((row) => row.id), ['completed'])
assert.ok(isTaskFolderUrl({ ...task, folderUrl: taskFolderUrl(task) }))
assert.equal(isTaskFolderUrl({ ...task, folderUrl: taskFolderUrl({ ...task, department: 'قسم آخر' }) }), false)

// Data access and ingestion must fail before touching storage without authorization.
const secret = 'test-session-secret-with-more-than-32-characters'
globalThis.Netlify = { env: { get: (name) => name === 'COURSE_SESSION_SECRET' ? secret : '' } }
const context = { params: { action: 'committee-data' } }
for (const cookie of ['', 'course_scope=malformed', 'course_scope=bad.fake']) {
  const response = await course(new Request('https://example.test/api/course/committee-data', { headers: { cookie } }), context)
  assert.equal(response.status, 401)
  assert.match(response.headers.get('Cache-Control'), /no-store/)
}
for (const session of [{ scope: 'قسم آخر', expires: Date.now() + 60000 }, { scope: 'all', expires: Date.now() - 1000 }]) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  assert.equal((await course(new Request('https://example.test/api/course/committee-data', { headers: { cookie: `course_scope=${payload}.${signature}` } }), context)).status, 401)
}
assert.equal((await course(new Request('https://example.test/api/course/committee-ingest', { method: 'POST', body: '{}' }), { params: { action: 'committee-ingest' } })).status, 401)
console.log('Committee access: four department scopes, private folder links, incomplete snapshots, task priorities and unauthorized access passed.')
