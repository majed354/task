import rawCalendar from './config/academicCalendar.json'

export type VerificationStatus = 'verified-taif' | 'verified-national' | 'official-benchmark' | 'unverified'
export type CalendarEventType = 'study' | 'exams' | 'pause'
export type TermType = 'first' | 'second' | 'summer'
export type TemporalStatus = 'لم يبدأ' | 'نافذة التنفيذ' | 'مهلة السماح' | 'انتهت المهلة'

export interface AcademicEvent {
  eventId: string
  label: string
  eventType: CalendarEventType
  start: string
  end: string
  issuingAuthority: string
  sourceTitle: string
  sourceUrl: string
  sourceLocator: string
  accessedAt: string
  applicability: VerificationStatus
  verificationStatus: VerificationStatus
  verificationNote: string
  reviewDueAt: string
  blocksOperationalWork: boolean
  skipOperationalWeek: boolean
}

interface ConfiguredTerm {
  id: string
  label: string
  academicYear: string
  termType: TermType
  orientationDays: number
  plannedOperationalWeeks: number
  graceWorkDays: number
  supportsFullCommitteePlan: boolean
  events: AcademicEvent[]
}

interface CalendarConfig {
  schemaVersion: string
  title: string
  reviewedAt: string
  reviewDueAt: string
  localAuthorityNote: string
  terms: ConfiguredTerm[]
}

export interface AcademicTerm extends ConfiguredTerm {
  start: string
  end: string
  examsStart?: string
  examsEnd?: string
}

export interface OperationalWeek {
  number: number
  label: string
  start: Date
  end: Date
  due: Date
  graceEnd: Date
  event: AcademicEvent | null
  graceShortenedByExams: boolean
}

const config = rawCalendar as CalendarConfig

export const calendarMeta = {
  schemaVersion: config.schemaVersion,
  title: config.title,
  reviewedAt: config.reviewedAt,
  reviewDueAt: config.reviewDueAt,
  localAuthorityNote: config.localAuthorityNote,
}

export function getStudyEvent(term: Pick<AcademicTerm, 'events'>) {
  return term.events.find((event) => event.eventType === 'study') as AcademicEvent
}

export function getExamEvent(term: Pick<AcademicTerm, 'events'>) {
  return term.events.find((event) => event.eventType === 'exams')
}

export function getPauseEvents(term: Pick<AcademicTerm, 'events'>) {
  return term.events.filter((event) => event.eventType === 'pause')
}

export const academicTerms: AcademicTerm[] = config.terms.map((term) => {
  const study = getStudyEvent(term)
  const exams = getExamEvent(term)
  return {
    ...term,
    start: study.start,
    end: study.end,
    examsStart: exams?.start,
    examsEnd: exams?.end,
  }
})

const dayMs = 86_400_000

export function parseLocalDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

export function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12)
}

export function addDays(value: Date, days: number) {
  const result = new Date(value)
  result.setDate(result.getDate() + days)
  return result
}

export function differenceInDays(later: Date, earlier: Date) {
  return Math.ceil((startOfLocalDay(later).getTime() - startOfLocalDay(earlier).getTime()) / dayMs)
}

function overlaps(start: Date, end: Date, event: AcademicEvent) {
  const eventStart = parseLocalDate(event.start)
  const eventEnd = parseLocalDate(event.end)
  return start <= eventEnd && end >= eventStart
}

function isWeekend(value: Date) {
  return value.getDay() === 5 || value.getDay() === 6
}

function isBlocked(value: Date, term: AcademicTerm, includeExams = true) {
  return term.events.some((event) => {
    if (!event.blocksOperationalWork || (!includeExams && event.eventType === 'exams')) return false
    const start = parseLocalDate(event.start)
    const end = parseLocalDate(event.end)
    return value >= start && value <= end
  })
}

function nextAvailableWorkDay(value: Date, term: AcademicTerm, includeExams = true) {
  let cursor = startOfLocalDay(value)
  while (isWeekend(cursor) || isBlocked(cursor, term, includeExams)) cursor = addDays(cursor, 1)
  return cursor
}

function previousWorkDay(value: Date) {
  let cursor = startOfLocalDay(value)
  while (isWeekend(cursor)) cursor = addDays(cursor, -1)
  return cursor
}

function addAvailableWorkDays(value: Date, days: number, term: AcademicTerm) {
  let cursor = startOfLocalDay(value)
  let remaining = days
  while (remaining > 0) {
    cursor = addDays(cursor, 1)
    if (!isWeekend(cursor) && !isBlocked(cursor, term, true)) remaining -= 1
  }
  return cursor
}

function nextSundayAfter(value: Date) {
  const result = addDays(value, 1)
  const daysToSunday = (7 - result.getDay()) % 7
  return addDays(result, daysToSunday)
}

export function getWorkStart(term: AcademicTerm) {
  return nextAvailableWorkDay(addDays(parseLocalDate(term.start), term.orientationDays), term, false)
}

export function buildOperationalWeeks(term: AcademicTerm): OperationalWeek[] {
  const weeks: OperationalWeek[] = []
  const termEnd = parseLocalDate(term.end)
  const exams = getExamEvent(term)
  const examsStart = exams ? parseLocalDate(exams.start) : null
  let cursor = getWorkStart(term)

  for (let number = 1; number <= term.plannedOperationalWeeks; number += 1) {
    let weekEnd = addDays(cursor, 6)
    let due = addDays(cursor, 4)
    let blockingPause = getPauseEvents(term).find((event) => event.skipOperationalWeek && overlaps(cursor, due, event))

    while (blockingPause) {
      cursor = nextSundayAfter(parseLocalDate(blockingPause.end))
      weekEnd = addDays(cursor, 6)
      due = addDays(cursor, 4)
      blockingPause = getPauseEvents(term).find((event) => event.skipOperationalWeek && overlaps(cursor, due, event))
    }

    if (cursor > termEnd || (examsStart && cursor >= examsStart)) break

    const event = getPauseEvents(term).find((pause) => overlaps(cursor, due, pause)) ?? null
    due = nextAvailableWorkDay(due, term, false)
    if (due > termEnd || (examsStart && due >= examsStart)) break

    const uncappedGraceEnd = addAvailableWorkDays(due, term.graceWorkDays, term)
    const examCap = examsStart ? previousWorkDay(addDays(examsStart, -1)) : null
    const graceShortenedByExams = Boolean(examCap && uncappedGraceEnd > examCap)
    const graceEnd = examCap && uncappedGraceEnd > examCap ? examCap : uncappedGraceEnd

    weeks.push({
      number,
      label: `الأسبوع ${number}`,
      start: cursor,
      end: weekEnd,
      due,
      graceEnd,
      event,
      graceShortenedByExams,
    })
    cursor = addDays(cursor, 7)
  }

  return weeks
}

export function getDefaultTerm(today = new Date()) {
  const current = academicTerms.find((term) => today >= parseLocalDate(term.start) && today <= parseLocalDate(term.end))
  if (current) return current
  return academicTerms.find((term) => parseLocalDate(term.start) > today) ?? academicTerms[academicTerms.length - 1]
}

export function getRelevantWeek(term: AcademicTerm, today = new Date()) {
  const weeks = buildOperationalWeeks(term)
  if (!weeks.length) return 0
  const active = weeks.find((week) => today >= week.start && today <= week.graceEnd)
  if (active) return active.number
  const next = weeks.find((week) => today < week.start)
  return next?.number ?? weeks[weeks.length - 1].number
}

export function formatGregorian(value: Date, includeYear = false) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    day: 'numeric',
    month: 'long',
    ...(includeYear ? { year: 'numeric' as const } : {}),
  }).format(value)
}

export function formatHijri(value: Date) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(value)
}

export function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { day: 'numeric', month: 'short' }).format(value)
}

export function formatLiveTime(value: Date) {
  return new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit' }).format(value)
}

export function daysUntil(value: Date, today = new Date()) {
  return Math.max(0, differenceInDays(value, today))
}

export function getTemporalState(start: Date, due: Date, graceEnd: Date, today = new Date()): TemporalStatus {
  if (today < start) return 'لم يبدأ'
  if (today <= due) return 'نافذة التنفيذ'
  if (today <= graceEnd) return 'مهلة السماح'
  return 'انتهت المهلة'
}
