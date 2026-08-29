import type { Task } from './data'

interface CalendarExportOptions {
  calendarName: string
  fileName: string
  generatedAt?: Date
}

const encoder = new TextEncoder()

function calendarDate(date: Date) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function utcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeCalendarText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function foldCalendarLine(value: string) {
  const lines: string[] = []
  let current = ''

  for (const character of Array.from(value)) {
    const next = `${current}${character}`
    if (current && encoder.encode(next).length > 73) {
      lines.push(current)
      current = ` ${character}`
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.join('\r\n')
}

function calendarWeekLabel(task: Task) {
  if (task.week === 0) return 'التهيئة'
  if (task.week === 16) return 'الاختبارات'
  return `الأسبوع ${task.week}`
}

function eventDescription(task: Task) {
  const steps = task.quickSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')
  return [
    `المطلوب: ${task.quickOutput}`,
    `المسؤول الوظيفي: ${task.responsibilities.executionRole}`,
    `المتابعة: ${task.responsibilities.recordCoordinationRole}`,
    `المحطة: ${calendarWeekLabel(task)}`,
    `خطوات التنفيذ:\n${steps}`,
    `الشاهد المطلوب: ${task.quickEvidence}`,
  ].join('\n\n')
}

export function createTaskCalendar(tasks: Task[], options: CalendarExportOptions) {
  const generatedAt = options.generatedAt ?? new Date()
  const orderedTasks = [...tasks].sort((a, b) => a.due.getTime() - b.due.getTime() || a.id.localeCompare(b.id))
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Committee Work Guide//AR//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeCalendarText(options.calendarName)}`,
    'X-WR-TIMEZONE:Asia/Riyadh',
  ]

  for (const task of orderedTasks) {
    const dueDate = calendarDate(task.due)
    const endDate = calendarDate(new Date(task.due.getFullYear(), task.due.getMonth(), task.due.getDate() + 1))
    lines.push(
      'BEGIN:VEVENT',
      `UID:${task.id}-${dueDate}@committee-work-guide.local`,
      `DTSTAMP:${utcStamp(generatedAt)}`,
      `DTSTART;VALUE=DATE:${dueDate}`,
      `DTEND;VALUE=DATE:${endDate}`,
      `SUMMARY:${escapeCalendarText(task.title)}`,
      `DESCRIPTION:${escapeCalendarText(eventDescription(task))}`,
      `CATEGORIES:${escapeCalendarText(task.committee)}`,
      'STATUS:CONFIRMED',
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeCalendarText(`غدًا موعد: ${task.title}`)}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }

  lines.push('END:VCALENDAR')
  const content = `${lines.map(foldCalendarLine).join('\r\n')}\r\n`
  const safeFileName = options.fileName
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return { content, fileName: `${safeFileName || 'تقويم-أعمال-اللجان'}.ics` }
}

export function downloadTaskCalendar(tasks: Task[], options: CalendarExportOptions) {
  const calendar = createTaskCalendar(tasks, options)
  const blob = new Blob([calendar.content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = calendar.fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
  return calendar.fileName
}
