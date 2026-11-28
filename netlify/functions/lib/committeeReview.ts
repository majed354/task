import { getStore } from '@netlify/blobs'
import type { CommitteeTaskSnapshot } from '../../../src/committeeTaskData.ts'
import type { CommitteeNewsItem } from '../../../src/committeeNews.ts'

const verdicts = ['مستوفٍ مبدئيًا', 'يحتاج استكمالًا', 'تعذر التحقق']
export function buildCommitteeReview(value: unknown, snapshot: CommitteeTaskSnapshot): CommitteeNewsItem & { inputHash: string; model: string } {
  if (!value || typeof value !== 'object') throw new Error('Invalid review')
  const body = value as Record<string, unknown>
  const task = snapshot.records.find((task) => task.id === body.taskId && task.term === body.term)
  if (!task || typeof body.reviewedAt !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(body.reviewedAt)
    || !Number.isFinite(Date.parse(body.reviewedAt)) || Date.parse(body.reviewedAt) > Date.now() + 300_000
    || typeof body.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(body.inputHash)
    || typeof body.verdict !== 'string' || !verdicts.includes(body.verdict)
    || !['gemini-4-neon-medium', 'gemini-4-neon-low'].includes(String(body.model))) throw new Error('Invalid review')
  return { id: `review:${task.term}:${task.id}:${body.inputHash}`, taskId: task.id, term: task.term,
    department: task.department, committee: task.committee, title: task.title, kind: 'review', status: body.verdict,
    observedAt: new Date(body.reviewedAt).toISOString(), inputHash: body.inputHash, model: String(body.model) }
}

export async function saveCommitteeReview(event: ReturnType<typeof buildCommitteeReview>): Promise<void> {
  const store = getStore({ name: 'committee-tasks-private', consistency: 'strong' })
  // Include the fingerprint in the key so retrying an upload does not create another item.
  const key = `news/${event.department}/${event.term}/${Date.parse(event.observedAt)}-review-${encodeURIComponent(event.taskId)}-${event.inputHash}`
  await store.setJSON(key, { events: [event] }, { onlyIfNew: true })
}
