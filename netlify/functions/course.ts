import { createHmac, scryptSync, timingSafeEqual } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import type { Config, Context } from '@netlify/functions'

type Scope = 'all' | 'قسم الشريعة' | 'قسم الأنظمة' | 'قسم القراءات' | 'قسم الثقافة الإسلامية'
type SheetRow = Array<string | number>
type ThesisRow = { term: string; code: string; department: string; section: string; member: string; gradeDate: string; observedTerms: number; basis: 'study' | 'member' }
type ThesisSignal = { department: string; code: string; member: string; terms: string[]; lastTerm: string; absentNextTerm: string; sections: number }
type Snapshot = { aggregateRows: SheetRow[]; courseRows: SheetRow[]; thesisRows?: ThesisRow[]; thesisSignals?: ThesisSignal[] }

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
    thesisRows: snapshot.thesisRows?.filter((row) => row.department === scope),
    thesisSignals: snapshot.thesisSignals?.filter((row) => row.department === scope) }
}

export default async function course(request: Request, context: Context): Promise<Response> {
  const action = context.params.action
  try {
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
