import { getStore } from '@netlify/blobs'
import { committeeChanges, scopedCommitteeNews, type CommitteeNewsItem } from '../../../src/committeeNews.ts'
import type { CommitteeTaskSnapshot } from '../../../src/committeeTaskData.ts'

type NewsBatch = { events: CommitteeNewsItem[] }
const newsStore = () => getStore({ name: 'committee-tasks-private', consistency: 'strong' })

export async function saveCommitteeNews(previous: CommitteeTaskSnapshot | null, snapshot: CommitteeTaskSnapshot): Promise<void> {
  const groups = new Map<string, CommitteeNewsItem[]>()
  for (const event of committeeChanges(previous, snapshot)) {
    const prefix = `news/${event.department}/${event.term}/`
    const key = prefix + Date.parse(event.observedAt)
    groups.set(key, [...(groups.get(key) || []), event])
  }
  const store = newsStore()
  // Immutable batches make retries safe, without a shared mutable news array.
  await Promise.all([...groups].map(([key, events]) => store.setJSON(key, { events }, { onlyIfNew: true })))
}

export async function loadCommitteeNews(snapshot: CommitteeTaskSnapshot): Promise<CommitteeNewsItem[]> {
  const store = newsStore()
  const departments = [...new Set(snapshot.records.map((task) => task.department))]
  const listings = await Promise.all(departments.map((department) => store.list({ prefix: `news/${department}/` })))
  const groups = new Map<string, string[]>()
  for (const { blobs } of listings) for (const { key } of blobs) {
    const group = key.slice(0, key.lastIndexOf('/'))
    groups.set(group, [...(groups.get(group) || []), key])
  }
  // Keep the latest 12 batches per department and term, before applying the UI filters.
  const keys = [...groups.values()].flatMap((group) => group.sort().reverse().slice(0, 12))
  const batches = await Promise.all(keys.map((key) => store.get(key, { type: 'json' }) as Promise<NewsBatch | null>))
  return scopedCommitteeNews(batches.flatMap((batch) => batch?.events || []), snapshot.records)
}
