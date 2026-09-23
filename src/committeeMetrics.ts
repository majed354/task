import type { CommitteeRecord } from './sharePointData'

export interface CommitteeCounts {
  total: number
  completed: number
  inProgress: number
  delayed: number
  pending: number
  withAdditionalFiles: number | null
}

export function riyadhDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const find = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${find('year')}-${find('month')}-${find('day')}`
}

export function isCompleted(status: string): boolean {
  return ['مكتمل', 'منجز', 'معتمد'].includes(status.trim())
}

export function isDelayed(record: CommitteeRecord, today: string): boolean {
  return record.status.trim() === 'متعثر'
    || Boolean(record.due && record.due < today && !isCompleted(record.status))
}

export function counts(records: CommitteeRecord[], today: string): CommitteeCounts {
  const completed = records.filter((record) => isCompleted(record.status)).length
  const delayed = records.filter((record) => isDelayed(record, today)).length
  const inProgress = records.filter((record) => record.status.trim() === 'قيد التنفيذ' && !isDelayed(record, today)).length
  const anyInventory = records.some((record) => record.additionalFolderItems !== null)
  return {
    total: records.length,
    completed,
    delayed,
    inProgress,
    pending: Math.max(0, records.length - completed - delayed - inProgress),
    withAdditionalFiles: anyInventory
      ? records.filter((record) => (record.additionalFolderItems ?? 0) > 0).length
      : null,
  }
}
