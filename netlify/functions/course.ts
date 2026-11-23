import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'
import { isCourseFolderPath, type CourseFolderLinks } from '../../src/courseFolderLinks.ts'
import { buildCommitteeSnapshot, scopedCommitteeSnapshot } from './lib/committeeSnapshot.ts'
import { loadCommitteeNews, saveCommitteeNews } from './lib/committeeNewsStore.ts'
import { buildCommitteeReview, saveCommitteeReview } from './lib/committeeReview.ts'
import { riyadhDate } from '../../src/committeeMetrics.ts'
import type { CommitteeTaskSnapshot } from '../../src/committeeTaskData.ts'
import { executionContext, executionTicket, executionSecret, memberBatchContext, memberBatchTicket, ExecutionError } from './lib/reportExecution.ts'
import { validOfficialSections, type OfficialSectionData } from '../../src/officialSectionData.ts'

type Scope = 'all' | 'قسم الشريعة' | 'قسم الأنظمة' | 'قسم القراءات' | 'قسم الثقافة الإسلامية'
type SheetRow = Array<string | number>
type ThesisRow = { term: string; code: string; department: string; section: string; member: string; gradeDate: string; observedTerms: number; basis: 'study' | 'member' }
type ThesisSignal = { department: string; code: string; member: string; terms: string[]; lastTerm: string; absentNextTerm: string; sections: number }
type Snapshot = { aggregateRows: SheetRow[]; courseRows: SheetRow[]; thesisRows?: ThesisRow[]; thesisSignals?: ThesisSignal[]; folderLinks?: CourseFolderLinks[]; sectionNumbers?: OfficialSectionData[] }

const scopes: Scope[] = ['all', 'قسم الشريعة', 'قسم الأنظمة', 'قسم القراءات', 'قسم الثقافة الإسلامية']
const departments = scopes.slice(1)
const cookieName = 'course_scope'
const sessionSeconds = 8 * 60 * 60
const attemptWindow = 10 * 60 * 1000
const maxAttempts = 10

function json(value: unknown, status = 200, cookie?: string): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie',
  })
  if (cookie) headers.set('Set-Cookie', cookie)
  return new Response(JSON.stringify(value), { status, headers })
}

function same(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function sessionSecret(): string {
  const secret = Netlify.env.get('COURSE_SESSION_SECRET')
  if (!secret || secret.length < 32) throw new Error('Course session secret is not configured')
  return secret
}

function sessionCookie(scope: Scope): string {
  const payload = Buffer.from(JSON.stringify({ scope, expires: Date.now() + sessionSeconds * 1000 })).toString('base64url')
  const signature = createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
  return `${cookieName}=${payload}.${signature}; Max-Age=${sessionSeconds}; Path=/api/course; HttpOnly; Secure; SameSite=Strict`
}

function clearCookie(): string {
  return `${cookieName}=; Max-Age=0; Path=/api/course; HttpOnly; Secure; SameSite=Strict`
}

function sessionScope(request: Request): Scope | null {
  const value = request.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`))?.[1]
  if (!value) return null
  const [payload, signature, extra] = value.split('.')
  if (!payload || !signature || extra) return null
  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('base64url')
  if (!same(signature, expected)) return null
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return scopes.includes(session.scope) && Number.isFinite(session.expires) && session.expires > Date.now() ? session.scope : null
  } catch { return null }
}

function matchPassword(password: string): Scope | null {
  const configured = JSON.parse(Netlify.env.get('COURSE_PASSWORD_HASHES') || '{}') as Record<string, string>
  let matched: Scope | null = null
  for (const scope of scopes) {
    const [salt, expected] = (configured[scope] || '').split(':')
    if (!salt || !expected || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{64}$/.test(expected)) throw new Error(`Missing course password hash: ${scope}`)
    const actual = scryptSync(password, Buffer.from(salt, 'hex'), 32)
    if (timingSafeEqual(actual, Buffer.from(expected, 'hex'))) matched = scope
  }
  return matched
}

export function normalizePassword(value: string): string {
  return value.trim().replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).toUpperCase()
}

function validateSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Snapshot
  if (!Array.isArray(snapshot.aggregateRows) || snapshot.aggregateRows.length !== 20 || !Array.isArray(snapshot.courseRows) || !snapshot.courseRows.length) return false
  const aggregateKeys = new Set<string>()
  for (const row of snapshot.aggregateRows) {
    if (!Array.isArray(row) || row.length !== 14 || !['٤٦١', '٤٦٢', '٤٧١', '٤٧٢'].includes(String(row[0])) || !['كل الأقسام', ...departments].includes(String(row[1])) || !Number.isFinite(Date.parse(String(row[8])))) return false
    aggregateKeys.add(`${row[0]}:${row[1]}`)
  }
  if (aggregateKeys.size !== 20) return false
  for (const row of snapshot.courseRows) {
    if (!Array.isArray(row) || row.length !== 14 || !['٤٦١', '٤٦٢', '٤٧١', '٤٧٢'].includes(String(row[0])) || !departments.includes(String(row[3]) as Scope) || !String(row[13]).trim()) return false
  }
  if (snapshot.sectionNumbers !== undefined && !validOfficialSections(snapshot.sectionNumbers, snapshot.courseRows)) return false
  if (snapshot.folderLinks !== undefined) {
    if (!Array.isArray(snapshot.folderLinks) || snapshot.folderLinks.length !== snapshot.courseRows.length) return false
    const sectionKeys = new Set(snapshot.courseRows.map((row) => `${row[0]}:${row[1]}:${row[3]}:${row[4]}`))
    const seen = new Set<string>()
    for (const row of snapshot.folderLinks) {
      const key = `${row.term}:${row.code}:${row.department}:${row.section}`
      if (!sectionKeys.has(key) || seen.has(key) || ![row.report, row.measurement, row.combined, row.combinedMeasurement].every((path) => isCourseFolderPath(path) && path.startsWith(`1-التقارير/${row.term}/`))) return false
      seen.add(key)
    }
  }
  if (snapshot.thesisRows !== undefined) {
    if (!Array.isArray(snapshot.thesisRows)) return false
    const thesisKeys = new Set(snapshot.courseRows.filter((row) => row[2] === 'الرسالة').map((row) => `${row[0]}:${row[1]}:${row[3]}:${row[4]}`))
    const seen = new Set<string>()
    for (const row of snapshot.thesisRows) {
      const key = `${row.term}:${row.code}:${row.department}:${row.section}`
      if (!thesisKeys.has(key) || seen.has(key) || !departments.includes(row.department as Scope) || !['study', 'member'].includes(row.basis) || !Number.isInteger(row.observedTerms) || row.observedTerms < 1 || row.observedTerms > 4 || (row.gradeDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.gradeDate))) return false
      seen.add(key)
    }
    if (seen.size !== thesisKeys.size) return false
  }
  if (snapshot.thesisSignals !== undefined && (!Array.isArray(snapshot.thesisSignals) || snapshot.thesisSignals.some((row) => !departments.includes(row.department as Scope) || !Array.isArray(row.terms) || !row.terms.every((term) => ['٤٦١', '٤٦٢', '٤٧١', '٤٧٢'].includes(term))))) return false
  return true
}

export function scopedSnapshot(snapshot: Snapshot, scope: Scope): Snapshot {
  if (scope === 'all') return snapshot
  const aggregateRows = snapshot.aggregateRows.filter((row) => row[1] === scope)
  const courseRows = snapshot.courseRows.filter((row) => row[3] === scope).map((row) => [...row])
  const byCourse = new Map<string, SheetRow[]>()
  for (const row of courseRows) {
    const key = `${row[0]}:${row[1]}`
    const sectionRows = byCourse.get(key) || []
    sectionRows.push(row)
    byCourse.set(key, sectionRows)
  }
  for (const sectionRows of byCourse.values()) {
    const count = sectionRows.length
    const covered = sectionRows.filter((row) => row[5] !== 'غير مسلّم').length
    const measured = sectionRows.filter((row) => Number(row[6]) === 1).length
    const combined = Number(sectionRows[0][7])
    const combinedMeasurement = Number(sectionRows[0][8])
    const required = count === 1 ? 2 : count * 2 + 2
    const done = count === 1 ? Number(covered > 0 || combined > 0) + Number(measured > 0 || combinedMeasurement > 0) : covered + measured + combined + combinedMeasurement
    for (const row of sectionRows) { row[9] = done; row[10] = required }
  }
  return { aggregateRows, courseRows,
    sectionNumbers: snapshot.sectionNumbers?.filter((row) => row.department === scope),
    folderLinks: snapshot.folderLinks?.filter((row) => row.department === scope),
    thesisRows: snapshot.thesisRows?.filter((row) => row.department === scope),
    thesisSignals: snapshot.thesisSignals?.filter((row) => row.department === scope) }
}

export default async function course(request: Request, context: Context): Promise<Response> {
  const action = context.params.action
  try {
    if ((action === 'execute' || action === 'execute-member') && request.method === 'POST') {
      if (request.headers.get('origin') !== new URL(request.url).origin || !request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'طلب تنفيذ غير صالح.' }, 403)
      const scope = sessionScope(request)
      if (!scope) return json({ error: 'يلزم إدخال رمز القسم.' }, 401)
      const text = await request.text()
      if (text.length > 2048) return json({ error: 'طلب التنفيذ أكبر من الحد المسموح.' }, 413)
      const body = JSON.parse(text) as Record<string, unknown>
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'طلب التنفيذ غير مكتمل.' }, 422)
      const snapshot = await getStore({ name: 'course-reports-private', consistency: 'strong' }).get('latest', { type: 'json' }) as Snapshot | null
      if (!snapshot || !validateSnapshot(snapshot)) return json({ error: 'بيانات التقارير غير متاحة.' }, 503)
      try {
        const secret = executionSecret(Netlify.env.get('COURSE_INGEST_KEY') || '')
        return json(action === 'execute-member' ? memberBatchTicket(memberBatchContext(snapshot, scope, body), secret) : executionTicket(executionContext(snapshot, scope, body), secret))
      }
      catch (error) { if (error instanceof ExecutionError) return json({ error: error.message }, error.status); throw error }
    }
    if (action === 'login' && request.method === 'POST') {
      const body = await request.json().catch(() => ({})) as { password?: unknown }
      const attempts = getStore({ name: 'course-login-attempts', consistency: 'strong' })
      const ipKey = createHmac('sha256', sessionSecret()).update(context.ip || 'unknown').digest('hex')
      const now = Date.now()
      const previous = await attempts.get(ipKey, { type: 'json' }) as { count: number; resetAt: number } | null
      const active = previous && previous.resetAt > now ? previous : { count: 0, resetAt: now + attemptWindow }
      if (active.count >= maxAttempts) return json({ error: 'محاولات كثيرة. حاول بعد عشر دقائق.' }, 429)
      const normalized = typeof body.password === 'string' && body.password.length <= 128 ? normalizePassword(body.password) : ''
      const scope = /^[A-Z][0-9]{4}$/.test(normalized) ? matchPassword(normalized) : null
      if (!scope) {
        await attempts.setJSON(ipKey, { count: active.count + 1, resetAt: active.resetAt })
        return json({ error: 'كلمة المرور غير صحيحة.' }, 401)
      }
      await attempts.delete(ipKey)
      return json({ scope }, 200, sessionCookie(scope))
    }
    if (action === 'logout' && request.method === 'POST') return json({ ok: true }, 200, clearCookie())
    if (action === 'committee-ingest' && request.method === 'POST') {
      const expected = Netlify.env.get('COURSE_INGEST_KEY') || ''
      if (expected.length < 32 || !same(request.headers.get('x-course-ingest-key') || '', expected)) return json({ error: 'غير مصرح.' }, 401)
      const body = await request.text()
      if (body.length > 5_000_000) return json({ error: 'الملف أكبر من الحد المسموح.' }, 413)
      let snapshot: CommitteeTaskSnapshot
      try { snapshot = buildCommitteeSnapshot(JSON.parse(body)) }
      catch { return json({ error: 'بيانات مهام اللجان غير مكتملة.' }, 422) }
      const store = getStore({ name: 'committee-tasks-private', consistency: 'strong' })
      const previous = await store.get('latest', { type: 'json' }) as CommitteeTaskSnapshot | null
      if (previous && Date.parse(previous.checkedAt) > Date.parse(snapshot.checkedAt)) return json({ error: 'اللقطة أقدم من آخر مزامنة.' }, 409)
      await saveCommitteeNews(previous, snapshot)
      await store.setJSON('latest', snapshot)
      return json({ ok: true, tasks: snapshot.records.length })
    }
    if (action === 'committee-submit' && request.method === 'POST') {
      const scope = sessionScope(request)
      if (!scope) return json({ error: 'يلزم إدخال رمز القسم.' }, 401)
      if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'طلب غير مسموح.' }, 403)
      const text = await request.text()
      if (text.length > 2000) return json({ error: 'طلب أكبر من الحد المسموح.' }, 413)
      let body: { taskId?: string; term?: string }
      try { body = JSON.parse(text) }
      catch { return json({ error: 'طلب غير صالح.' }, 400) }
      if (!body || typeof body.taskId !== 'string' || typeof body.term !== 'string') return json({ error: 'طلب غير صالح.' }, 400)
      const store = getStore({ name: 'committee-tasks-private', consistency: 'strong' })
      const snapshot = await store.get('latest', { type: 'json' }) as CommitteeTaskSnapshot | null
      const task = snapshot?.records.find((task) => task.id === body.taskId && task.term === body.term && (scope === 'all' || task.department === scope))
      if (!task) return json({ error: 'المهمة غير متاحة في نطاقك.' }, 404)
      const observedAt = new Date().toISOString()
      const day = riyadhDate(new Date(observedAt))
      const event = { id: `submission:${task.term}:${task.id}:${day}`, taskId: task.id, term: task.term, department: task.department,
        committee: task.committee, title: task.title, kind: 'submission', status: 'بانتظار فحص المستندات', observedAt }
      const key = `news/${task.department}/${task.term}/${Date.parse(day)}-submission-${encodeURIComponent(task.id)}`
      await store.setJSON(key, { events: [event] }, { onlyIfNew: true })
      return json({ ok: true })
    }
    if (action === 'committee-review-ingest' && request.method === 'POST') {
      const expected = Netlify.env.get('COURSE_INGEST_KEY') || ''
      if (expected.length < 32 || !same(request.headers.get('x-course-ingest-key') || '', expected)) return json({ error: 'غير مصرح.' }, 401)
      const body = await request.text()
      if (body.length > 20_000) return json({ error: 'الملف أكبر من الحد المسموح.' }, 413)
      const snapshot = await getStore({ name: 'committee-tasks-private', consistency: 'strong' }).get('latest', { type: 'json' }) as CommitteeTaskSnapshot | null
      if (!snapshot) return json({ error: 'بيانات مهام اللجان غير متاحة حاليًا.' }, 503)
      let review: ReturnType<typeof buildCommitteeReview>
      try { review = buildCommitteeReview(JSON.parse(body), snapshot) }
      catch { return json({ error: 'بيانات المراجعة غير مكتملة.' }, 422) }
      await saveCommitteeReview(review)
      return json({ ok: true, reviewId: review.id })
    }
    if (action === 'committee-data' && request.method === 'GET') {
      const scope = sessionScope(request)
      if (!scope) return json({ error: 'يلزم إدخال رمز القسم.' }, 401)
      const store = getStore({ name: 'committee-tasks-private', consistency: 'strong' })
      const snapshot = await store.get('latest', { type: 'json' }) as CommitteeTaskSnapshot | null
      if (!snapshot) return json({ error: 'بيانات مهام اللجان غير متاحة حاليًا.' }, 503)
      const scoped = scopedCommitteeSnapshot(snapshot, scope)
      try { return json({ scope, ...scoped, news: await loadCommitteeNews(scoped) }) }
      catch (error) {
        console.error('Committee news could not be loaded', error)
        return json({ scope, ...scoped, news: [], newsUnavailable: true })
      }
    }
    if (action === 'ingest' && request.method === 'POST') {
      const expected = Netlify.env.get('COURSE_INGEST_KEY') || ''
      if (expected.length < 32 || !same(request.headers.get('x-course-ingest-key') || '', expected)) return json({ error: 'غير مصرح.' }, 401)
      const body = await request.text()
      if (body.length > 5_000_000) return json({ error: 'الملف أكبر من الحد المسموح.' }, 413)
      const snapshot = JSON.parse(body) as unknown
      if (!validateSnapshot(snapshot)) return json({ error: 'بيانات التقارير غير مكتملة.' }, 422)
      const store = getStore({ name: 'course-reports-private', consistency: 'strong' })
      await store.setJSON('latest', snapshot)
      return json({ ok: true, sections: snapshot.courseRows.length })
    }
    if (action === 'data' && request.method === 'GET') {
      const scope = sessionScope(request)
      if (!scope) return json({ error: 'يلزم إدخال كلمة المرور.' }, 401)
      const store = getStore({ name: 'course-reports-private', consistency: 'strong' })
      const snapshot = await store.get('latest', { type: 'json' }) as Snapshot | null
      if (!snapshot || !validateSnapshot(snapshot)) return json({ error: 'بيانات التقارير غير متاحة حاليًا.' }, 503)
      return json({ scope, ...scopedSnapshot(snapshot, scope) })
    }
    return json({ error: 'الطلب غير معروف.' }, 404)
  } catch (error) {
    console.error('Course access failed', error)
    return json({ error: 'تعذّر إتمام الطلب الآن.' }, 500)
  }
}

export const config: Config = { path: '/api/course/:action' }
