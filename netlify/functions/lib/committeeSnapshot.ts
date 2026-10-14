import catalog from './committeeCatalog.json' with { type: 'json' }
import { committeeDepartments, committeeTerms, isTaskFolderUrl, taskFolderUrl, westernTerm, type CommitteeTaskSnapshot } from '../../../src/committeeTaskData.ts'

const metadata = new Map(catalog.map((task) => [task.id, task]))
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value
const validSegment = (value: string) => Boolean(value.trim()) && !/[\\/\u0000-\u001f]/.test(value) && !['.', '..'].includes(value)

export function buildCommitteeSnapshot(value: unknown): CommitteeTaskSnapshot {
  if (!value || typeof value !== 'object') throw new Error('Missing committee snapshot')
  const input = value as { items?: unknown; checkedAt?: unknown }
  if (!Array.isArray(input.items) || input.items.length < 340 || input.items.length > 10000 || typeof input.checkedAt !== 'string'
    || !/(?:Z|[+-]\d{2}:\d{2})$/.test(input.checkedAt) || !Number.isFinite(Date.parse(input.checkedAt)) || Date.parse(input.checkedAt) > Date.now() + 300000) throw new Error('Incomplete committee snapshot')
  const seen = new Set<string>()
  const records = input.items.map((item: Record<string, unknown>) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid task')
    const text = (key: string) => String(item[key] ?? '').trim()
    const id = text('i'), department = text('d'), committee = text('c'), term = westernTerm(text('f') || '٤٨١')
    const known = metadata.get(id)
    const title = text('h') || known?.title || ''
    const due = text('t').slice(0, 10)
    const start = text('b').slice(0, 10) || (term === '481' ? known?.start || '' : '')
    const status = text('s')
    if (!id || seen.has(`${term}:${id}`) || !committeeDepartments.some((d) => d === department) || !committeeTerms.some((t) => t === term)
      || !validSegment(committee) || !validSegment(title) || !validDate(due) || (start && (!validDate(start) || start > due))
      || !['لم يبدأ', 'قيد التنفيذ', 'متعثر', 'مكتمل', 'منجز', 'معتمد'].includes(status)
      || (known && (known.department !== department || known.committee !== committee))) throw new Error(`Invalid task: ${id}`)
    seen.add(`${term}:${id}`)
    const task = { id, department, committee, term, title, start, due, status,
      period: known?.period || '', deliverable: known?.deliverable || '', evidence: known?.evidence || '', folderUrl: '' }
    task.folderUrl = text('u') || taskFolderUrl(task)
    if (!isTaskFolderUrl(task)) throw new Error(`Invalid task folder: ${id}`)
    return task
  })
  for (const department of committeeDepartments) if (!records.some((task) => task.department === department)) throw new Error('Missing department')
  return { records, checkedAt: input.checkedAt }
}
export function scopedCommitteeSnapshot(snapshot: CommitteeTaskSnapshot, scope: string): CommitteeTaskSnapshot {
  return { checkedAt: snapshot.checkedAt, records: snapshot.records.filter((task) => scope === 'all' || task.department === scope) }
}
