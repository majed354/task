import { createHmac, randomUUID } from 'node:crypto'
import { isCourseFolderPath, type CourseFolderLinks } from '../../../src/courseFolderLinks.ts'

export const trialOrigin = 'https://academic-reports-trial-20261006.netlify.app'
export const executionKinds = ['report', 'measurement', 'combined', 'combinedMeasurement'] as const
type Kind = typeof executionKinds[number]
type Row = Array<string | number>
export class ExecutionError extends Error {
  status: number
  constructor(message: string, status = 422) { super(message); this.status = status }
}
const digits = (value: unknown) => String(value ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

export function executionContext(snapshot: { courseRows: Row[]; folderLinks?: CourseFolderLinks[] }, scope: string, body: Record<string, unknown>) {
  if (Object.keys(body).sort().join(',') !== 'code,department,kind,section,term' || !executionKinds.includes(body.kind as Kind)) throw new ExecutionError('المتطلب المطلوب غير معروف.')
  const key = [body.term, body.code, body.department, body.section].map(digits).join(':')
  const source = snapshot.courseRows.find(row => [row[0], row[1], row[3], row[4]].map(digits).join(':') === key)
  if (!source || (scope !== 'all' && source[3] !== scope)) throw new ExecutionError('المقرر خارج نطاق صلاحيتك.', 403)
  if (source[2] === 'الرسالة') throw new ExecutionError('تقارير الرسائل تحتاج مسارها المختص.')
  const kind = body.kind as Kind
  const links = snapshot.folderLinks?.find(row => [row.term, row.code, row.department, row.section].map(digits).join(':') === key)
  const folder = links?.[kind]
  if (!folder || !isCourseFolderPath(folder)) throw new ExecutionError('مجلد الرفع لم يُعتمد بعد.')
  const combined = kind === 'combined' || kind === 'combinedMeasurement'
  const rows = combined ? snapshot.courseRows.filter(row => row[0] === source[0] && row[1] === source[1]) : [source]
  if (rows.some(row => scope !== 'all' && row[3] !== scope)) throw new ExecutionError('هذا المقرر مشترك بين أقسام؛ تنفيذ المتطلب المجمع يحتاج رمز العرض الكلي.', 403)
  if (new Set(rows.map(row => [row[0], row[1], row[3], row[4]].join(':'))).size !== rows.length) throw new ExecutionError('سجل الشعب يحتاج مراجعة.')
  const expectedEnding = { report: '/01-تقرير-المقرر', measurement: '/02-قياس-مخرجات-تعلم-المقرر', combinedMeasurement: '/05-قياس-مخرجات-المقرر-المجمع' }[kind as Exclude<Kind, 'combined'>]
  if (expectedEnding && !folder.endsWith(expectedEnding)) throw new ExecutionError('وجهة الرفع لا تطابق نوع المتطلب.')
  if (kind === 'combined' && !folder.startsWith(`1-التقارير/${source[0]}/00-التقارير-المجمعة-للمقررات/`)) throw new ExecutionError('وجهة التقرير المجمع غير صالحة.')
  return { term: digits(source[0]), code: String(source[1]), name: String(source[2]), department: String(source[3]), section: String(source[4]), member: String(source[13]), kind, folder,
    destinations: { report: combined ? links!.combined : links!.report, measurement: combined ? links!.combinedMeasurement : links!.measurement },
    rows: rows.map(row => ({ department: String(row[3]), section: String(row[4]), member: String(row[13]) })) }
}

export function executionTicket(context: ReturnType<typeof executionContext>, secret: string, now = Math.floor(Date.now() / 1000)) {
  if (secret.length < 48) throw new ExecutionError('خدمة تنفيذ التقارير لم تُفعّل بعد.', 503)
  const claims = { v: 1, iss: 'https://shari3ahtask.netlify.app', aud: trialOrigin, jti: randomUUID(), iat: now, exp: now + 3 * 60 * 60, ...context }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const ticket = `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
  return { url: `${trialOrigin}/#committee=${ticket}` }
}

// A separate purpose key derived from the existing private dashboard connection.
// The ingestion key itself is never sent in a ticket or copied into frontend code.
export function executionSecret(ingestKey: string) {
  return ingestKey.length >= 32 ? createHmac('sha256', ingestKey).update('academic-trial-execution-v1').digest('hex') : ''
}

/** One signed member bundle; each section retains its independent destinations. */
export function memberBatchContext(snapshot: { courseRows: Row[]; folderLinks?: CourseFolderLinks[] }, scope: string, body: Record<string, unknown>) {
  if (Object.keys(body).sort().join(',') !== 'department,member,terms' || typeof body.member !== 'string' || !body.member.trim() || !Array.isArray(body.terms) || !body.terms.length || body.terms.length > 4 || !body.terms.every(t => ['461','462','471','472'].includes(digits(t))) || typeof body.department !== 'string') throw new ExecutionError('حدد العضو والفصول المطلوبة.')
  const terms = [...new Set(body.terms.map(digits))].sort()
  const rows = snapshot.courseRows.filter(row => terms.includes(digits(row[0])) && String(row[13]) === body.member && row[2] !== 'الرسالة' && (body.department === 'كل الأقسام' || row[3] === body.department))
  if (!rows.length) throw new ExecutionError('لا توجد مقررات مستحقة لهذا العضو في النطاق.')
  if (rows.some(row => scope !== 'all' && row[3] !== scope)) throw new ExecutionError('الحزمة خارج نطاق صلاحيتك.', 403)
  if (rows.length > 60) throw new ExecutionError('اختر فصولًا أقل؛ الحد 60 شعبة في الحزمة.')
  const keys = rows.map(row => [row[0], row[1], row[3], row[4]].join(':'))
  if (new Set(keys).size !== keys.length) throw new ExecutionError('سجل الشعب يحتاج مراجعة.')
  const items = rows.map(row => {
    const single = snapshot.courseRows.filter(r => r[0] === row[0] && r[1] === row[1]).length === 1
    const needs = { report: row[5] === 'غير مسلّم' && !(single && Number(row[7]) === 1), measurement: Number(row[6]) !== 1 && !(single && Number(row[8]) === 1) }
    try {
      const context = executionContext(snapshot, scope, { term: digits(row[0]), code: String(row[1]), department: String(row[3]), section: String(row[4]), kind: 'report' })
      if (!isCourseFolderPath(context.destinations.measurement) || !context.destinations.measurement.endsWith('/02-قياس-مخرجات-تعلم-المقرر')) throw new ExecutionError('مجلد قياس المخرجات لم يُعتمد.')
      return { ...context, id: randomUUID(), needs }
    } catch (error) {
      if (!(error instanceof ExecutionError)) throw error
      return { id: randomUUID(), term: digits(row[0]), code: String(row[1]), name: String(row[2]), department: String(row[3]), section: String(row[4]), member: String(row[13]), needs, unavailable: error.message }
    }
  })
  return { member: body.member, terms, items }
}

export function memberBatchTicket(context: ReturnType<typeof memberBatchContext>, secret: string, now = Math.floor(Date.now() / 1000)) {
  if (secret.length < 48) throw new ExecutionError('خدمة تنفيذ التقارير لم تُفعّل بعد.', 503)
  const claims = { v: 2, kind: 'memberBatch', iss: 'https://shari3ahtask.netlify.app', aud: trialOrigin, jti: randomUUID(), iat: now, exp: now + 10800, ...context }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return { url: `${trialOrigin}/#committee=${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}` }
}
