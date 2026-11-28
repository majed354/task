import { isCompleted } from './committeeMetrics.ts'
import type { CommitteeTask, CommitteeTaskSnapshot } from './committeeTaskData.ts'

export interface CommitteeNewsItem {
  id: string
  taskId: string
  term: string
  department: string
  committee: string
  title: string
  kind: 'added' | 'completed' | 'status' | 'recorded' | 'review' | 'submission'
  status: string
  observedAt: string
}

export const taskKey = (task: { term: string; id: string }) => `${task.term}:${task.id}`

// Capture observed transitions, rather than treating every scheduled task as new.
export function committeeChanges(previous: CommitteeTaskSnapshot | null, current: CommitteeTaskSnapshot): CommitteeNewsItem[] {
  if (!previous || Date.parse(current.checkedAt) <= Date.parse(previous.checkedAt)) return []
  const old = new Map(previous.records.map((task) => [taskKey(task), task]))
  return current.records.flatMap((task) => {
    const before = old.get(taskKey(task))
    const kind = !before ? 'added' : !isCompleted(before.status) && isCompleted(task.status) ? 'completed'
      : before.status !== task.status && !(isCompleted(before.status) && isCompleted(task.status)) ? 'status' : null
    if (!kind) return []
    return [{ id: `${current.checkedAt}:${taskKey(task)}:${kind}`, taskId: task.id, term: task.term,
      department: task.department, committee: task.committee, title: task.title, kind, status: task.status, observedAt: current.checkedAt }]
  })
}

export function scopedCommitteeNews(news: CommitteeNewsItem[], records: CommitteeTask[]): CommitteeNewsItem[] {
  const allowed = new Map(records.map((task) => [taskKey(task), task]))
  const seen = new Set<string>()
  return news.filter((item) => {
    const task = allowed.get(`${item.term}:${item.taskId}`)
    return task && task.department === item.department && task.committee === item.committee
  }).sort((a, b) => b.observedAt.localeCompare(a.observedAt) || a.id.localeCompare(b.id)).filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
}

export function committeeNewsForView(news: CommitteeNewsItem[], records: CommitteeTask[]): CommitteeNewsItem[] {
  const events = scopedCommitteeNews(news, records)
  const reported = new Set(events.map((item) => `${item.term}:${item.taskId}`))
  // Existing completions have no trustworthy completion date. Show them explicitly without one.
  return [...events, ...records.filter((task) => isCompleted(task.status) && !reported.has(taskKey(task))).map((task) => ({
    id: `recorded:${taskKey(task)}`, taskId: task.id, term: task.term, department: task.department,
    committee: task.committee, title: task.title, kind: 'recorded' as const, status: task.status, observedAt: '',
  }))]
}

export function committeeNewsLabel(item: CommitteeNewsItem): string {
  return item.kind === 'added' ? 'مهمة مضافة' : item.kind === 'completed' ? 'إنجاز مهمة'
    : item.kind === 'recorded' ? 'إنجاز مسجل' : item.kind === 'review' ? `مراجعة المستندات: ${item.status}`
      : item.kind === 'submission' ? 'طلب مراجعة المستندات' : `تحديث الحالة: ${item.status}`
}
