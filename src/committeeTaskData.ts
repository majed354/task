import { isCompleted, riyadhDate } from './committeeMetrics.ts'
import type { CourseAccessScope } from './courseReportData'
import type { CommitteeNewsItem } from './committeeNews.ts'

export const committeeDepartments = ['قسم الشريعة', 'قسم الأنظمة', 'قسم القراءات', 'قسم الثقافة الإسلامية'] as const
export const committeeTerms = ['481', '461', '462', '471', '472'] as const
export interface CommitteeTask {
  id: string
  term: string
  department: string
  committee: string
  title: string
  start: string
  due: string
  status: string
  folderUrl: string
  period: string
  deliverable: string
  evidence: string
}
export interface CommitteeTaskSnapshot { records: CommitteeTask[]; checkedAt: string; news?: CommitteeNewsItem[]; newsUnavailable?: boolean }
export type TaskView = 'actionable' | 'upcoming' | 'completed' | 'all'
export const termDigits = (value: string) => value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
export const westernTerm = (value: string) => value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
export const committeeFolderBase = '/sites/msteams_3b4354/Shared Documents/أعمال اللجان/دليل مهام اللجان/'

export function taskFolderUrl(task: Pick<CommitteeTask, 'term' | 'department' | 'committee' | 'title'>): string {
  const path = committeeFolderBase + [termDigits(task.term), task.department, task.committee, task.title].join('/')
  return `https://taifedusa.sharepoint.com/sites/msteams_3b4354/Shared%20Documents/Forms/AllItems.aspx?id=${encodeURIComponent(path)}`
}
export function isTaskFolderUrl(task: CommitteeTask): boolean {
  try {
    const url = new URL(task.folderUrl)
    const expected = new URL(taskFolderUrl(task))
    return url.origin === expected.origin && !url.username && !url.password && url.pathname === expected.pathname
      && url.searchParams.get('id') === expected.searchParams.get('id')
  } catch { return false }
}
export function taskState(task: CommitteeTask, today = riyadhDate()): 'completed' | 'delayed' | 'upcoming' | 'active' | 'pending' {
  if (isCompleted(task.status)) return 'completed'
  if (task.status === 'متعثر' || task.due < today) return 'delayed'
  if (task.start && task.start > today) return 'upcoming'
  return task.status === 'قيد التنفيذ' ? 'active' : 'pending'
}
export function tasksForView(records: CommitteeTask[], view: TaskView, today = riyadhDate()): CommitteeTask[] {
  const priority = { delayed: 0, active: 1, pending: 2, upcoming: 3, completed: 4 }
  return records.filter((task) => {
    const state = taskState(task, today)
    return view === 'all' || (view === 'completed' ? state === 'completed' : view === 'upcoming' ? state === 'upcoming' : !['completed', 'upcoming'].includes(state))
  }).sort((a, b) => priority[taskState(a, today)] - priority[taskState(b, today)] || a.due.localeCompare(b.due) || a.id.localeCompare(b.id))
}
export class CommitteeAccessError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export async function loadCommitteeTasks(): Promise<CommitteeTaskSnapshot & { scope: CourseAccessScope }> {
  const response = await fetch('/api/course/committee-data', { credentials: 'same-origin', cache: 'no-store' })
  if (!response.ok) throw new CommitteeAccessError(response.status, response.status === 401 ? 'يلزم إدخال رمز القسم.' : 'تعذّر تحميل مهام اللجان الآن.')
  const value = await response.json() as CommitteeTaskSnapshot & { scope: CourseAccessScope }
  if (!['all', ...committeeDepartments].includes(value.scope) || !Array.isArray(value.records) || !Number.isFinite(Date.parse(value.checkedAt))
    || value.records.some((task) => (value.scope !== 'all' && task.department !== value.scope) || !isTaskFolderUrl(task))) throw new Error('بيانات مهام اللجان غير مكتملة.')
  return value
}
