export interface AcademicPause {
  label: string
  start: string
  end: string
  skipOperationalWeek: boolean
}

export interface AcademicTerm {
  id: string
  label: string
  academicYear: string
  start: string
  end: string
  examsStart: string
  examsEnd: string
  orientationDays: number
  operationalWeeks: number
  graceDays: number
  officialSourceLabel: string
  officialSourceUrl: string
  verificationNote: string
  pauses: AcademicPause[]
}

export interface OperationalWeek {
  number: number
  label: string
  start: Date
  end: Date
  due: Date
  graceEnd: Date
  event: string | null
}

export const academicTerms: AcademicTerm[] = [
  {
    id: '1448-first',
    label: 'الفصل الدراسي الأول 1448هـ',
    academicYear: '1448-1449هـ',
    start: '2026-08-23',
    end: '2027-01-07',
    examsStart: '2026-12-20',
    examsEnd: '2027-01-07',
    orientationDays: 7,
    operationalWeeks: 15,
    graceDays: 7,
    officialSourceLabel: 'التقويم الجامعي الرسمي - جامعة جدة',
    officialSourceUrl: 'https://www.uj.edu.sa/ar/التقويم-الجامعي',
    verificationNote: 'مرجع جامعي رسمي متوافق مع تاريخ البداية المعلن في جامعات سعودية متعددة، ويستبدل بتقويم جامعة الطائف فور نشر نسخته التفصيلية.',
    pauses: [
      { label: 'إجازة اليوم الوطني', start: '2026-09-23', end: '2026-09-24', skipOperationalWeek: false },
      { label: 'إجازة الخريف', start: '2026-11-20', end: '2026-11-28', skipOperationalWeek: true },
    ],
  },
  {
    id: '1448-second',
    label: 'الفصل الدراسي الثاني 1448هـ',
    academicYear: '1448-1449هـ',
    start: '2027-01-17',
    end: '2027-06-17',
    examsStart: '2027-05-30',
    examsEnd: '2027-06-17',
    orientationDays: 7,
    operationalWeeks: 15,
    graceDays: 7,
    officialSourceLabel: 'التقويم الجامعي الرسمي - جامعة جدة',
    officialSourceUrl: 'https://www.uj.edu.sa/ar/التقويم-الجامعي',
    verificationNote: 'بنية الفصل محفوظة في ملف إعداد مستقل؛ مواعيد الفصول والإجازات من المرجع الرسمي، وبداية الاختبارات متحققة من تقويم جامعي رسمي ثانٍ.',
    pauses: [
      { label: 'إجازة يوم التأسيس', start: '2027-02-21', end: '2027-02-22', skipOperationalWeek: false },
      { label: 'إجازة عيد الفطر', start: '2027-02-26', end: '2027-03-13', skipOperationalWeek: true },
      { label: 'إجازة عيد الأضحى', start: '2027-05-07', end: '2027-05-22', skipOperationalWeek: true },
    ],
  },
]

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

function overlaps(start: Date, end: Date, pause: AcademicPause) {
  const pauseStart = parseLocalDate(pause.start)
  const pauseEnd = parseLocalDate(pause.end)
  return start <= pauseEnd && end >= pauseStart
}

function nextSundayAfter(value: Date) {
  const result = addDays(value, 1)
  const daysToSunday = (7 - result.getDay()) % 7
  return addDays(result, daysToSunday)
}

export function getWorkStart(term: AcademicTerm) {
  return addDays(parseLocalDate(term.start), term.orientationDays)
}

export function buildOperationalWeeks(term: AcademicTerm): OperationalWeek[] {
  const weeks: OperationalWeek[] = []
  let cursor = getWorkStart(term)

  for (let number = 1; number <= term.operationalWeeks; number += 1) {
    let weekEnd = addDays(cursor, 6)
    let due = addDays(cursor, 4)
    let blockingPause = term.pauses.find((pause) => pause.skipOperationalWeek && overlaps(cursor, due, pause))

    while (blockingPause) {
      cursor = nextSundayAfter(parseLocalDate(blockingPause.end))
      weekEnd = addDays(cursor, 6)
      due = addDays(cursor, 4)
      blockingPause = term.pauses.find((pause) => pause.skipOperationalWeek && overlaps(cursor, due, pause))
    }

    const event = term.pauses.find((pause) => !pause.skipOperationalWeek && overlaps(cursor, due, pause))?.label ?? null
    weeks.push({
      number,
      label: `الأسبوع ${number}`,
      start: cursor,
      end: weekEnd,
      due,
      graceEnd: addDays(due, term.graceDays),
      event,
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

export function daysUntil(value: Date, today = new Date()) {
  return Math.max(0, differenceInDays(value, today))
}

export function getTemporalState(start: Date, due: Date, graceEnd: Date, today = new Date()) {
  if (today < start) return 'قادم' as const
  if (today <= due) return 'مفتوح' as const
  if (today <= graceEnd) return 'فترة سماح' as const
  return 'متأخر' as const
}
