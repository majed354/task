import {
  CSSProperties,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  ClipboardCheck,
  FileCheck2,
  Download,
  ListChecks,
  Menu,
  Search,
  UsersRound,
  X,
} from 'lucide-react'
import {
  academicTerms,
  addDays,
  buildOperationalWeeks,
  compareLocalDates,
  daysUntil,
  formatGregorian,
  formatShortDate,
  getCommitteePlanStart,
  getCommitteePreparationDue,
  getDefaultTerm,
  getExamEvent,
  getRelevantWeek,
  getWorkStart,
  parseLocalDate,
  TemporalStatus,
} from './academicCalendar'
import {
  buildTasksForTerm,
  normalizeSearchText,
  Task,
  taskSearchIndex,
} from './data'
import { downloadTaskCalendar } from './calendarExport'

const allCommittees = 'كل أنواع اللجان'

const temporalClass: Record<TemporalStatus, string> = {
  'لم يبدأ': 'status-upcoming',
  'نافذة التنفيذ': 'status-open',
  'مهلة السماح': 'status-grace',
  'انتهت المهلة': 'status-ended',
}

const committeePalette = ['#176d62', '#996b2a', '#4e6fa8', '#765ca4', '#b04f52', '#3d7d9d', '#56844b', '#8a5e78', '#416f6a', '#9a623f', '#5f6b7a']

interface TimelineItem {
  key: string
  label: string
  start: Date
  end: Date
  due: Date
  kind: 'preparation' | 'week' | 'exams'
  note?: string
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function taskNumber(id: string) {
  const value = Number(id.match(/\d+/)?.[0] ?? 0)
  return `مهمة ${new Intl.NumberFormat('ar-SA', { minimumIntegerDigits: 2, useGrouping: false }).format(value)}`
}

function taskCountLabel(count: number) {
  if (count === 1) return 'مهمة واحدة'
  if (count === 2) return 'مهمتان'
  if (count >= 3 && count <= 10) return `${count} مهام`
  return `${count} مهمة`
}

function AccessibleDialog({ children, onClose, titleId }: { children: ReactNode; onClose: () => void; titleId: string }) {
  const dialogRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = oldOverflow
      previousFocus.current?.focus()
    }
  }, [onClose])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section ref={dialogRef} className="task-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {children}
      </section>
    </div>
  )
}

function InfoList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={ordered ? 'info-list ordered-list' : 'info-list'}>
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>
          {ordered ? <span>{index + 1}</span> : <CheckCircle2 size={17} aria-hidden="true" />}
          <p>{item}</p>
        </li>
      ))}
    </Tag>
  )
}

function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <AccessibleDialog onClose={onClose} titleId="task-modal-title">
      <header className="modal-header">
        <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق تفاصيل المهمة" data-autofocus><X size={22} /></button>
        <div>
          <div className="modal-kickers"><span>{taskNumber(task.id)}</span><span className={`status-pill ${temporalClass[task.temporalStatus]}`}>{task.temporalStatus}</span></div>
          <h2 id="task-modal-title">{task.title}</h2>
          <p>{task.committee}</p>
        </div>
      </header>

      <div className="modal-content">
        <section className="output-card">
          <div className="output-icon"><CheckCircle2 size={23} /></div>
          <div><span>المطلوب</span><h3>{task.quickOutput}</h3></div>
        </section>

        <div className="modal-meta-grid">
          <section><span>المسؤول الوظيفي</span><strong>{task.responsibilities.executionRole}</strong><small>يتابعها {task.responsibilities.recordCoordinationRole}</small></section>
          <section><span>الموعد</span><strong>{formatGregorian(task.due, true)}</strong><small>{task.temporalStatus}</small></section>
        </div>

        <section className="detail-panel">
          <div className="panel-title"><ListChecks size={20} /><h3>أنجزها في ثلاث خطوات</h3></div>
          <InfoList items={task.quickSteps} ordered />
        </section>

        <section className="evidence-card"><FileCheck2 size={22} /><div><span>الشاهد المطلوب</span><strong>{task.quickEvidence}</strong></div></section>

        <section className="detail-panel evidence-components">
          <div className="panel-title"><ClipboardCheck size={20} /><h3>مكونات الشاهد</h3></div>
          <InfoList items={task.evidenceComponents} />
        </section>
      </div>

      <footer className="modal-actions"><button className="secondary-button" type="button" onClick={onClose}>إغلاق</button></footer>
    </AccessibleDialog>
  )
}

function timelineKeyFor(term: (typeof academicTerms)[number], now: Date) {
  const planStart = getCommitteePlanStart(term)
  const workStart = getWorkStart(term)
  const exam = getExamEvent(term)
  if (compareLocalDates(now, workStart) < 0) return '0'
  if (exam && compareLocalDates(now, parseLocalDate(exam.start)) >= 0) return '16'
  return String(getRelevantWeek(term, now))
}

function Dashboard() {
  const now = useNow()
  const initialTerm = useMemo(() => getDefaultTerm(now), [])
  const [termId, setTermId] = useState(initialTerm.id)
  const term = academicTerms.find((item) => item.id === termId) ?? initialTerm
  const weeks = useMemo(() => buildOperationalWeeks(term), [term])
  const allTasks = useMemo(() => buildTasksForTerm(term, now), [term, now])
  const [committee, setCommittee] = useState(allCommittees)
  const [weekFilter, setWeekFilter] = useState(() => timelineKeyFor(initialTerm, now))
  const [query, setQuery] = useState('')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [calendarNotice, setCalendarNotice] = useState('')

  const selectedTask = selectedTaskId ? allTasks.find((task) => task.id === selectedTaskId) ?? null : null
  const currentTimelineKey = timelineKeyFor(term, now)
  const committeeOptions = useMemo(() => Array.from(new Set(allTasks.map((task) => task.committee))).sort((a, b) => a.localeCompare(b, 'ar')), [allTasks])

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const preparationStart = getCommitteePlanStart(term)
    const workStart = getWorkStart(term)
    const exam = getExamEvent(term)
    const items: TimelineItem[] = [{
      key: '0',
      label: 'التهيئة',
      start: preparationStart,
      end: addDays(workStart, -1),
      due: getCommitteePreparationDue(term),
      kind: 'preparation',
      note: 'تهيئة اللجان قبل الأسابيع التشغيلية',
    }]
    items.push(...weeks.map((week) => ({
      key: String(week.number),
      label: `الأسبوع ${week.number}`,
      start: week.start,
      end: week.end,
      due: week.due,
      kind: 'week' as const,
      note: week.event?.label,
    })))
    if (exam) items.push({
      key: '16',
      label: 'الاختبارات',
      start: parseLocalDate(exam.start),
      end: parseLocalDate(exam.end),
      due: parseLocalDate(exam.end),
      kind: 'exams',
      note: 'مهام فترة الاختبارات',
    })
    return items
  }, [term, weeks])

  useEffect(() => {
    function readHash() {
      const id = decodeURIComponent(window.location.hash.match(/^#task=(.+)$/)?.[1] ?? '')
      if (id && allTasks.some((task) => task.id === id)) setSelectedTaskId(id)
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [allTasks])

  const normalizedQuery = normalizeSearchText(query)
  const filteredTasks = useMemo(() => allTasks.filter((task) => {
    const matchesCommittee = committee === allCommittees || task.committee === committee
    const matchesWeek = weekFilter === 'all' || task.week === Number(weekFilter)
    const matchesQuery = !normalizedQuery || taskSearchIndex(task).includes(normalizedQuery)
    return matchesCommittee && matchesWeek && matchesQuery
  }), [allTasks, committee, normalizedQuery, weekFilter])

  const committeeSummaries = useMemo(() => committeeOptions.map((name, index) => {
    const tasks = allTasks.filter((task) => task.committee === name)
    const upcoming = tasks
      .filter((task) => compareLocalDates(now, task.graceEnd) <= 0)
      .sort((a, b) => a.start.getTime() - b.start.getTime() || a.due.getTime() - b.due.getTime())[0] ?? tasks[0]
    return { name, tasks, upcoming, color: committeePalette[index % committeePalette.length] }
  }), [allTasks, committeeOptions, now])

  const scopedTasks = allTasks.filter((task) => committee === allCommittees || task.committee === committee)
  const nextTask = [...scopedTasks]
    .filter((task) => compareLocalDates(now, task.graceEnd) <= 0)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || a.due.getTime() - b.due.getTime())[0] ?? scopedTasks[0]
  const nextMilestone = nextTask
    ? compareLocalDates(now, nextTask.start) < 0
      ? { label: 'يبدأ التنفيذ بعد', date: nextTask.start }
      : compareLocalDates(now, nextTask.due) <= 0
        ? { label: 'موعد التسليم بعد', date: nextTask.due }
        : { label: 'تنتهي المهلة بعد', date: nextTask.graceEnd }
    : null

  const selectedTimeline = weekFilter === 'all' ? null : timelineItems.find((item) => item.key === weekFilter) ?? null
  const selectedTimelineTasks = allTasks.filter((task) => (weekFilter === 'all' || task.week === Number(weekFilter)) && (committee === allCommittees || task.committee === committee))

  function openTask(task: Task) {
    setSelectedTaskId(task.id)
    window.history.pushState(null, '', `#task=${encodeURIComponent(task.id)}`)
  }

  function closeTask() {
    setSelectedTaskId(null)
    if (window.location.hash.startsWith('#task=')) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }

  function selectCommittee(name: string) {
    setCommittee(name)
    document.querySelector('#timeline')?.scrollIntoView({ behavior: 'smooth' })
  }

  function changeTerm(nextId: string) {
    const nextTerm = academicTerms.find((item) => item.id === nextId) ?? initialTerm
    setTermId(nextId)
    setCommittee(allCommittees)
    setWeekFilter(timelineKeyFor(nextTerm, now))
    setQuery('')
  }

  function downloadCalendar() {
    if (!selectedTimelineTasks.length) return
    const committeeLabel = committee === allCommittees ? 'جميع اللجان' : committee
    const periodLabel = selectedTimeline?.label ?? 'الفصل كاملًا'
    const fileName = downloadTaskCalendar(selectedTimelineTasks, {
      calendarName: `أعمال اللجان — ${committeeLabel} — ${periodLabel}`,
      fileName: `تقويم أعمال اللجان ${committeeLabel} ${periodLabel}`,
    })
    setCalendarNotice(`تم تنزيل ${fileName}`)
    window.setTimeout(() => setCalendarNotice(''), 4_000)
  }

  return (
    <div className="app-shell" dir="rtl">
      <header className="topbar" id="top">
        <a className="brand" href="#top" aria-label="دليل أعمال اللجان"><span className="brand-mark"><BookOpenCheck size={23} /></span><span><small>كلية الشريعة والأنظمة</small><strong>دليل أعمال اللجان</strong></span></a>
        <nav className={mobileMenu ? 'topnav is-open' : 'topnav'} aria-label="التنقل الرئيسي">
          <a href="#committees" onClick={() => setMobileMenu(false)}>أنواع اللجان</a>
          <a href="#timeline" onClick={() => setMobileMenu(false)}>الخطة الزمنية</a>
          <a href="#calendar-export" onClick={() => setMobileMenu(false)}>تحميل التقويم</a>
          <a href="#tasks" onClick={() => setMobileMenu(false)}>المهام</a>
        </nav>
        <button className="menu-button" type="button" aria-label="فتح القائمة" aria-expanded={mobileMenu} onClick={() => setMobileMenu((value) => !value)}><Menu size={23} /></button>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">مهام اللجان <em>في وقتها</em></h1>
            <p>اختر لجنتك واعرف مهمة الأسبوع وخطواتها والشاهد المطلوب.</p>
            <div className="hero-actions"><a className="primary-button" href="#committees">اللجان <UsersRound size={17} /></a><a className="hero-text-link" href="#timeline">الخطة الزمنية <ChevronLeft size={16} /></a></div>
            <div className="hero-stats" aria-label="ملخص الدليل"><span><strong>{committeeOptions.length}</strong> نوع لجنة</span><span><strong>{allTasks.length}</strong> مهمة موحدة</span></div>
          </div>

          <aside className="today-panel" aria-label="المهمة الأقرب">
            <div className="today-head"><span>المهمة الأقرب</span>{nextTask && <strong>{formatGregorian(nextTask.due)}</strong>}</div>
            {nextTask && nextMilestone && <div className="next-focus">
              <section><span>{nextTask.committee}</span><h2>{nextTask.title}</h2><button type="button" onClick={() => openTask(nextTask)}>عرض التفاصيل <ChevronLeft size={16} /></button></section>
              <div><span>{nextMilestone.label}</span><strong>{daysUntil(nextMilestone.date, now)}</strong><small>يومًا</small></div>
            </div>}
          </aside>
        </section>

        <section className="content-section committees-section" id="committees">
          <div className="section-heading">
            <h2>أنواع اللجان</h2>
            <span className="section-count">{committeeOptions.length} لجنة وجهة عمل</span>
          </div>
          <div className="committee-grid">
            {committeeSummaries.map((summary) => (
              <article key={summary.name} className={`committee-card ${committee === summary.name ? 'is-selected' : ''}`} style={{ '--committee-color': summary.color } as CSSProperties}>
                <div className="committee-card-head"><span className="committee-icon"><UsersRound size={21} /></span><span className="committee-count">{taskCountLabel(summary.tasks.length)}</span></div>
                <h3>{summary.name}</h3>
                <div className="committee-next"><span>المهمة الأقرب</span><strong>{summary.upcoming?.title ?? 'لا توجد مهام'}</strong><small>{summary.upcoming ? formatGregorian(summary.upcoming.due) : '—'}</small></div>
                <button type="button" onClick={() => selectCommittee(summary.name)}>عرض الخطة <ChevronLeft size={18} /></button>
              </article>
            ))}
          </div>
        </section>

        <section className="timeline-section" id="timeline">
          <div className="timeline-wrap">
            <div className="section-heading timeline-heading">
              <h2>الخطة الزمنية</h2>
              <label className="term-select"><span>الفصل</span><select value={termId} onChange={(event) => changeTerm(event.target.value)}>{academicTerms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            </div>

            <div className="timeline-rail" aria-label="محطات الفصل">
              <button type="button" className={`timeline-all ${weekFilter === 'all' ? 'is-selected' : ''}`} onClick={() => setWeekFilter('all')} data-key="all"><CalendarCheck2 size={19} /><span>كل الفصل</span><strong>{allTasks.length}</strong></button>
              {timelineItems.map((item) => {
                const taskCount = allTasks.filter((task) => task.week === Number(item.key)).length
                return <button type="button" key={item.key} data-key={item.key} className={`timeline-node ${weekFilter === item.key ? 'is-selected' : ''} ${currentTimelineKey === item.key ? 'is-current' : ''} kind-${item.kind}`} aria-pressed={weekFilter === item.key} onClick={() => setWeekFilter(item.key)}>
                  <span className="node-dot"><CircleDot size={15} /></span>
                  <small>{currentTimelineKey === item.key ? 'المحطة الحالية' : formatShortDate(item.start)}</small>
                  <strong>{item.label}</strong>
                  <span>{taskCountLabel(taskCount)}</span>
                </button>
              })}
            </div>

            <div className="timeline-detail">
              <div className="timeline-period">
                <span>{selectedTimeline ? selectedTimeline.label : 'الفصل كاملًا'}</span>
                <h3>{selectedTimeline ? `${formatGregorian(selectedTimeline.start)} — ${formatGregorian(selectedTimeline.end, true)}` : `${formatGregorian(getCommitteePlanStart(term))} — ${formatGregorian(parseLocalDate(term.end), true)}`}</h3>
              </div>
              <div className="timeline-preview">
                <strong>{selectedTimelineTasks.length}</strong>
                <span>{committee === allCommittees ? 'مهمة في النطاق' : committee}</span>
                <a href="#tasks">عرض المهام <ChevronLeft size={16} /></a>
              </div>
            </div>

            <section className="calendar-export" id="calendar-export" aria-labelledby="calendar-export-title">
              <div className="calendar-export-copy">
                <h3 id="calendar-export-title">تحميل التقويم</h3><p>ملف أسبوع أو فصل كامل، حسب اللجنة التي تختارها.</p>
              </div>
              <div className="calendar-export-controls">
                <label><span>اللجنة</span><select value={committee} onChange={(event) => setCommittee(event.target.value)}><option>{allCommittees}</option>{committeeOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
                <label><span>النطاق الزمني</span><select value={weekFilter} onChange={(event) => setWeekFilter(event.target.value)}><option value="all">الفصل كاملًا</option>{timelineItems.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
                <button type="button" onClick={downloadCalendar} disabled={!selectedTimelineTasks.length}><Download size={19} /> تحميل {taskCountLabel(selectedTimelineTasks.length)} <small>.ics</small></button>
              </div>
              <div className="calendar-compatibility">ملف `.ics` متوافق مع Google Calendar وتقويم Apple وOutlook.</div>
              <p className="calendar-notice" aria-live="polite">{calendarNotice}</p>
            </section>
          </div>
        </section>

        <section className="content-section tasks-section" id="tasks">
          <div className="section-heading">
            <h2>المهام</h2>
            <span className="section-count"><strong>{filteredTasks.length}</strong> مهمة</span>
          </div>

          <div className="task-filters">
            <label className="search-field"><span>البحث</span><div><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بعنوان المهمة أو الشاهد" /></div></label>
            <label><span>نوع اللجنة</span><select value={committee} onChange={(event) => setCommittee(event.target.value)}><option>{allCommittees}</option>{committeeOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>المحطة الزمنية</span><select value={weekFilter} onChange={(event) => setWeekFilter(event.target.value)}><option value="all">كل الفصل</option>{timelineItems.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          </div>

          {(committee !== allCommittees || weekFilter !== 'all' || query) && <div className="active-filter-bar"><span>العرض الحالي:</span>{committee !== allCommittees && <button type="button" onClick={() => setCommittee(allCommittees)}>{committee} <X size={15} /></button>}{weekFilter !== 'all' && <button type="button" onClick={() => setWeekFilter('all')}>{timelineItems.find((item) => item.key === weekFilter)?.label} <X size={15} /></button>}{query && <button type="button" onClick={() => setQuery('')}>«{query}» <X size={15} /></button>}<button className="clear-button" type="button" onClick={() => { setCommittee(allCommittees); setWeekFilter('all'); setQuery('') }}>مسح الكل</button></div>}

          {filteredTasks.length ? <div className="task-grid">
            {filteredTasks.map((task) => <article className="task-card" key={task.id}>
              <div className="task-card-head"><span className="task-committee">{task.committee}</span><span className={`status-pill ${temporalClass[task.temporalStatus]}`}>{task.temporalStatus}</span></div>
              <h3>{task.title}</h3>
              <div className="task-date"><CalendarDays size={16} /><span>الموعد <strong>{formatGregorian(task.due)}</strong></span></div>
              <div className="task-evidence"><span>الشاهد</span><strong>{task.quickEvidence}</strong></div>
              <button className="task-open" type="button" onClick={() => openTask(task)}>كيف أنجزها؟ <ChevronLeft size={18} /></button>
            </article>)}
          </div> : <div className="empty-state"><Search size={28} /><h3>لا توجد مهام مطابقة</h3><p>جرّب اختيار لجنة أو محطة زمنية أخرى.</p><button type="button" onClick={() => { setCommittee(allCommittees); setWeekFilter('all'); setQuery('') }}>عرض كل المهام</button></div>}
        </section>

      </main>

      <footer className="site-footer"><strong>دليل أعمال اللجان</strong><span>كلية الشريعة والأنظمة</span></footer>
      {selectedTask && <TaskModal task={selectedTask} onClose={closeTask} />}
    </div>
  )
}

export default function App() {
  return <Dashboard />
}
