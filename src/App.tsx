import {
  CSSProperties,
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpLeft,
  BookOpenCheck,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clipboard,
  ClipboardCheck,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderOpen,
  Info,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  UsersRound,
  X,
} from 'lucide-react'
import {
  academicTerms,
  addDays,
  buildOperationalWeeks,
  calendarMeta,
  compareLocalDates,
  daysUntil,
  differenceInDays,
  formatGregorian,
  formatHijri,
  formatLiveTime,
  formatShortDate,
  getCommitteePlanStart,
  getDefaultTerm,
  getExamEvent,
  getRelevantWeek,
  getStudyEvent,
  getWorkStart,
  parseLocalDate,
  TemporalStatus,
} from './academicCalendar'
import {
  buildTasksForTerm,
  Department,
  departmentDetails,
  departments,
  normalizeSearchText,
  Task,
  taskSearchIndex,
  templateById,
  templates,
} from './data'

const sharePointUrl = 'https://taifedusa.sharepoint.com/sites/CommitteeQuality'
const powerBiUrl = 'https://app.powerbi.com/groups/me/reports/aa400403-e1d0-41df-8cc2-e99de8624584/64c51bcc9d1370803690?experience=power-bi'
const allCommitteeScopes = 'كل اللجان والجهات'

const temporalClass: Record<TemporalStatus, string> = {
  'لم يبدأ': 'status-upcoming',
  'نافذة التنفيذ': 'status-open',
  'مهلة السماح': 'status-grace',
  'انتهت المهلة': 'status-ended',
}

const departmentAccents: Record<string, string> = {
  'قسم القراءات': '#167064',
  'قسم الثقافة الإسلامية': '#a9772f',
  'قسم الشريعة': '#6758a6',
  'قسم الأنظمة': '#2f789b',
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
}

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function storedValue(key: string, fallback: string) {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function AccessGate({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (normalizeDigits(code).trim() === '1429') {
      sessionStorage.setItem('committee-portal-access', 'granted')
      onUnlock()
      return
    }
    setError(true)
  }

  return (
    <main className="access-page" dir="rtl">
      <section className="access-intro" aria-labelledby="access-title">
        <div className="access-brand">
          <div className="brand-mark brand-mark-light" aria-hidden="true"><BookOpenCheck size={24} /></div>
          <div><span>كلية الشريعة والأنظمة</span><strong>بوابة أعمال اللجان</strong></div>
        </div>
        <div className="access-copy">
          <span className="eyebrow eyebrow-light"><ShieldCheck size={17} /> مرجع التنفيذ والأدلة</span>
          <h1 id="access-title">اعرف مهمتك، ونفّذها بدليلٍ واضح.</h1>
          <p>مهام اللجان، المواعيد المرنة، أدلة الإجراء، والقوالب المعتمدة للعمل في مكان واحد.</p>
        </div>
        <p className="access-footnote">العام الجامعي 1448-1449هـ</p>
      </section>
      <section className="access-form-wrap">
        <form className="access-card" onSubmit={submit}>
          <div className="access-icon"><LockKeyhole size={25} /></div>
          <span className="access-kicker">دخول أعضاء اللجان</span>
          <h2>مرحبًا بعودتك</h2>
          <p>أدخل رمز الوصول لمشاهدة خطة العمل.</p>
          <label htmlFor="access-code">رمز الوصول</label>
          <div className={`code-field ${error ? 'has-error' : ''}`}>
            <KeyRound size={20} aria-hidden="true" />
            <input
              id="access-code"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="أدخل الرمز"
              value={code}
              onChange={(event) => { setCode(event.target.value); setError(false) }}
              aria-invalid={error}
              aria-describedby={error ? 'access-error' : 'access-help'}
              autoFocus
            />
          </div>
          {error && <span className="form-error" id="access-error" role="alert"><CircleAlert size={17} /> رمز الوصول غير صحيح</span>}
          <button className="primary-button access-button" type="submit">دخول البوابة <ArrowLeft size={19} /></button>
          <div className="access-note" id="access-help"><ShieldCheck size={18} /><span>يقبل الأرقام العربية أو الإنجليزية. هذه حماية للنسخة التجريبية.</span></div>
        </form>
      </section>
    </main>
  )
}

function AccessibleDialog({ children, onClose, titleId, className = '' }: { children: ReactNode; onClose: () => void; titleId: string; className?: string }) {
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
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
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
      <section ref={dialogRef} className={`task-modal ${className}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {children}
      </section>
    </div>
  )
}

function InfoList({ items, ordered = false }: { items: string[]; ordered?: boolean }) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={ordered ? 'detail-list ordered-list' : 'detail-list'}>
      {items.map((item, index) => <li key={`${item}-${index}`}>{ordered ? <span>{index + 1}</span> : <CheckCircle2 size={18} aria-hidden="true" />}<p>{item}</p></li>)}
    </Tag>
  )
}

function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const primaryTemplate = templateById(task.primaryTemplateId)
  const companions = task.companionTemplateIds.map(templateById)
  const [copied, setCopied] = useState<string | null>(null)

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setCopied('تعذر النسخ')
    }
  }

  const permanentLink = `${window.location.origin}${window.location.pathname}${window.location.search}#task=${encodeURIComponent(task.id)}`

  return (
    <AccessibleDialog onClose={onClose} titleId="task-modal-title" className="task-detail-modal">
      <header className="modal-header simple-modal-header">
        <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق تفاصيل المهمة" data-autofocus><X size={22} /></button>
        <div className="modal-title-copy">
          <div className="modal-kickers"><span className="task-code">{task.id}</span><span className={`status-pill ${temporalClass[task.temporalStatus]}`}>{task.temporalStatus}</span></div>
          <h2 id="task-modal-title">{task.title}</h2>
          <p>{task.committee} · {task.department}</p>
        </div>
      </header>

      <div className="modal-content simple-task-content">
        <section className="quick-output-card">
          <div className="quick-icon"><CheckCircle2 size={24} /></div>
          <div><span>المطلوب</span><h3>{task.quickOutput}</h3></div>
        </section>

        <div className="quick-meta-grid">
          <section><span>المنفذ</span><strong>{task.committee}</strong><small>تنسيق السجل: {task.recordCoordinator}</small></section>
          <section><span>الموعد</span><strong>{formatGregorian(task.due, true)}</strong><small>{task.temporalStatus}</small></section>
        </div>

        <section className="quick-steps-panel"><div className="section-title"><ListChecks size={21} /><h3>أنجزها في {task.quickSteps.length} خطوات</h3></div><InfoList items={task.quickSteps} ordered /></section>

        <section className="quick-evidence-card"><FileCheck2 size={22} /><div><span>الشاهد الكافي</span><strong>{task.quickEvidence}</strong></div></section>

        {task.quickTemplateRequired ? <section className="quick-template-card"><div><FileText size={23} /><span><small>ابدأ بهذا القالب</small><strong>{primaryTemplate.name}</strong></span></div><a href={`/templates/${primaryTemplate.file}`} download>تحميل <Download size={18} /></a></section> : <section className="no-template-card"><Check size={21} /><div><strong>لا يحتاج قالبًا إضافيًا</strong><span>استخدم الجدول الأسبوعي للأعضاء ثم انشر الجدول العام.</span></div></section>}

        {task.quickTemplateRequired && <details className="advanced-task-details">
          <summary>تفاصيل إضافية عند الحاجة <ChevronDown size={19} /></summary>
          <div className="advanced-task-content">
            <div className="status-pair" aria-label="حالتا الموعد والتسليم"><div><span>حالة الموعد</span><strong className={`status-pill ${temporalClass[task.temporalStatus]}`}>{task.temporalStatus}</strong></div><div><span>حالة التسليم الفعلية</span><strong className="status-pill delivery-pending">{task.deliveryStatus}</strong><small>لا توجد بيانات رفع حية بعد</small></div></div>
            <div className="modal-summary"><div><span>بدء التنفيذ</span><strong>{formatGregorian(task.start, true)}</strong></div><div><span>المخرج التفصيلي</span><strong>{task.finalOutput}</strong></div><div><span>نهاية المهلة</span><strong>{formatGregorian(task.graceEnd, true)}</strong></div></div>
            <div className="timing-callout"><CalendarClock size={20} /><div><strong>قاعدة الموعد</strong><span>{task.timingNote} {task.earlySubmissionNote}</span></div></div>
            {task.privacyClass.startsWith('مقيد') && <div className="privacy-callout"><ShieldCheck size={20} /><div><strong>تنبيه عند وجود بيانات مقيدة</strong><span>لا تُدرج أسماء الطلبة أو أي بيانات شخصية في اسم الملف أو داخل هذه البوابة.</span></div></div>}
            <section className="modal-section objective-section"><div className="section-icon"><Target size={20} /></div><div><span className="detail-eyebrow">{task.guideTitle}</span><h3>الهدف والنطاق</h3><p>{task.guideDefinition}</p><p><strong>الهدف:</strong> {task.objective}</p><p><strong>النطاق:</strong> {task.guideScope}</p></div></section>
            <div className="responsibility-grid"><section><span>المسؤول المباشر</span><strong>{task.executionOwner}</strong></section><section><span>المراجع</span><strong>{task.reviewer}</strong></section><section><span>المعتمد</span><strong>{task.approver}</strong></section><section><span>المدة المتوقعة</span><strong>{task.expectedDuration}</strong></section></div>
            <div className="detail-columns"><section className="detail-panel"><div className="section-title"><FolderOpen size={20} /><h3>المدخلات</h3></div><InfoList items={task.inputs} /></section><section className="detail-panel"><div className="section-title"><FileCheck2 size={20} /><h3>الأدلة الكاملة</h3></div><InfoList items={task.evidence} /></section></div>
            <section className="detail-panel full-panel"><div className="section-title"><ListChecks size={20} /><h3>الدليل التفصيلي</h3></div><InfoList items={task.executionSteps} ordered /></section>
            <div className="detail-columns"><section className="detail-panel"><div className="section-title"><ClipboardCheck size={20} /><h3>معايير القبول</h3></div><InfoList items={task.acceptanceCriteria} /></section><section className="detail-panel error-panel"><div className="section-title"><AlertTriangle size={20} /><h3>أخطاء شائعة</h3></div><InfoList items={task.commonErrors} /></section></div>
            <div className="detail-columns"><section className="detail-panel"><div className="section-title"><ShieldCheck size={20} /><h3>المراجعة والاعتماد</h3></div><p>{task.approvalMethod}</p></section><section className="detail-panel"><div className="section-title"><BookOpenCheck size={20} /><h3>صلة الدراسة الذاتية</h3></div><InfoList items={task.selfStudyConnections} /></section></div>
            <section className="delivery-panel" aria-labelledby="delivery-title"><div className="section-title"><FolderOpen size={20} /><h3 id="delivery-title">التسمية والتسليم</h3></div><div className="delivery-field"><span>اسم الملف المقترح</span><code dir="ltr">{task.fileName}</code><button type="button" onClick={() => copyText(task.fileName, 'file')}><Clipboard size={17} /> {copied === 'file' ? 'تم النسخ' : 'نسخ الاسم'}</button></div><div className="delivery-field"><span>مسار مقترح — غير معتمد</span><code>{task.proposedSharePointPath}</code><button type="button" onClick={() => copyText(task.proposedSharePointPath, 'path')}><Clipboard size={17} /> {copied === 'path' ? 'تم النسخ' : 'نسخ المسار'}</button></div><p className="delivery-warning"><Info size={18} /> بنية مجلد المهمة لم تُربط بعد.</p><div className="advanced-links"><button className="soft-button" type="button" onClick={() => copyText(permanentLink, 'link')}><Clipboard size={17} /> {copied === 'link' ? 'تم نسخ الرابط' : 'نسخ رابط المهمة'}</button><a className="soft-button" href={sharePointUrl} target="_blank" rel="noreferrer">فتح جذر SharePoint <ArrowUpLeft size={17} /></a></div></section>
            <section className="companion-templates"><h3>قوالب مرافقة</h3><div>{companions.map((template) => <a key={template.id} href={`/templates/${template.file}`} download><FileText size={18} /><span>{template.name}</span><Download size={17} /></a>)}</div></section>
          </div>
        </details>}
      </div>

      <footer className="modal-actions">
        {task.quickTemplateRequired ? <a className="primary-button" href={`/templates/${primaryTemplate.file}`} download>تحميل القالب والبدء <Download size={18} /></a> : <span className="no-template-note">الشاهد المطلوب: الجدول العام المنشور فقط.</span>}
        <button className="secondary-button" type="button" onClick={onClose}>إغلاق</button>
      </footer>
    </AccessibleDialog>
  )
}

function TemplateModal({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const template = templateById(templateId)
  return (
    <AccessibleDialog onClose={onClose} titleId="template-modal-title" className="template-modal">
      <header className="modal-header">
        <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق تفاصيل القالب" data-autofocus><X size={22} /></button>
        <div className="modal-title-copy"><div className="modal-kickers"><span>{template.category}</span><span>إصدار {template.version}</span><span>{template.type}</span></div><h2 id="template-modal-title">{template.name}</h2><p>{template.description}</p></div>
      </header>
      <div className="modal-content">
        <section className="modal-section"><div className="section-icon"><Info size={20} /></div><div><h3>متى يستخدم؟</h3><p>{template.whenToUse}</p></div></section>
        <section className="detail-panel full-panel"><div className="section-title"><ListChecks size={20} /><h3>طريقة الاستخدام</h3></div><InfoList items={template.steps} ordered /></section>
        <section className="detail-panel full-panel"><div className="section-title"><ClipboardCheck size={20} /><h3>علامات القالب المكتمل</h3></div><InfoList items={template.qualityChecks} /></section>
        <a className="primary-button modal-download" href={`/templates/${template.file}`} download><Download size={19} /> تحميل {template.type === 'Word' ? 'ملف Word' : 'ملف Excel'}</a>
      </div>
    </AccessibleDialog>
  )
}

function Dashboard() {
  const now = useNow()
  const initialTerm = useMemo(() => getDefaultTerm(now), [])
  const [termId, setTermId] = useState(initialTerm.id)
  const term = academicTerms.find((item) => item.id === termId) ?? initialTerm
  const weeks = useMemo(() => buildOperationalWeeks(term), [term])
  const [query, setQuery] = useState('')
  const [department, setDepartment] = useState<Department>(() => {
    const stored = storedValue('committee-preferred-department', 'جميع الأقسام')
    return departments.includes(stored as Department) ? stored as Department : 'جميع الأقسام'
  })
  const [committee, setCommittee] = useState(() => {
    const stored = storedValue('committee-preferred-committee', allCommitteeScopes)
    return stored === 'جميع اللجان' ? allCommitteeScopes : stored
  })
  const [weekFilter, setWeekFilter] = useState('all')
  const [guideFilter, setGuideFilter] = useState('all')
  const [outputFilter, setOutputFilter] = useState('all')
  const [temporalFilter, setTemporalFilter] = useState('all')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [visibleCount, setVisibleCount] = useState(40)
  const weekTrackRef = useRef<HTMLDivElement>(null)

  const allTasks = useMemo(() => buildTasksForTerm(term, now), [term, now])
  const selectedTask = selectedTaskId ? allTasks.find((task) => task.id === selectedTaskId) ?? null : null
  const committeeOptions = useMemo(() => Array.from(new Set(allTasks.filter((task) => department === 'جميع الأقسام' || task.department === department).map((task) => task.committee))).sort((a, b) => a.localeCompare(b, 'ar')), [allTasks, department])
  const guideOptions = useMemo(() => Array.from(new Set(allTasks.map((task) => task.guideTitle))).sort((a, b) => a.localeCompare(b, 'ar')), [allTasks])
  const outputOptions = useMemo(() => Array.from(new Set(allTasks.map((task) => task.outputType))).sort((a, b) => a.localeCompare(b, 'ar')), [allTasks])

  useEffect(() => {
    try { localStorage.setItem('committee-preferred-department', department) } catch { /* التخزين المحلي اختياري */ }
  }, [department])
  useEffect(() => {
    try { localStorage.setItem('committee-preferred-committee', committee) } catch { /* التخزين المحلي اختياري */ }
  }, [committee])
  useEffect(() => {
    if (committee !== allCommitteeScopes && !committeeOptions.includes(committee)) setCommittee(allCommitteeScopes)
  }, [committee, committeeOptions])

  useEffect(() => {
    function readHash() {
      const match = window.location.hash.match(/^#task=(.+)$/)
      if (!match) return
      const id = decodeURIComponent(match[1])
      if (allTasks.some((task) => task.id === id)) setSelectedTaskId(id)
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [allTasks])

  useEffect(() => setVisibleCount(40), [query, department, committee, weekFilter, guideFilter, outputFilter, temporalFilter, termId])

  useEffect(() => {
    if (weekFilter === 'all') return
    const active = weekTrackRef.current?.querySelector<HTMLElement>(`[data-week="${weekFilter}"]`)
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [weekFilter])

  const normalizedQuery = normalizeSearchText(query)
  const filteredTasks = useMemo(() => allTasks.filter((task) => {
    const matchesQuery = !normalizedQuery || taskSearchIndex(task).includes(normalizedQuery)
    const matchesDepartment = department === 'جميع الأقسام' || task.department === department
    const matchesCommittee = committee === allCommitteeScopes || task.committee === committee
    const matchesWeek = weekFilter === 'all' || task.week === Number(weekFilter)
    const matchesGuide = guideFilter === 'all' || task.guideTitle === guideFilter
    const matchesOutput = outputFilter === 'all' || task.outputType === outputFilter
    const matchesTemporal = temporalFilter === 'all' || task.temporalStatus === temporalFilter
    return matchesQuery && matchesDepartment && matchesCommittee && matchesWeek && matchesGuide && matchesOutput && matchesTemporal
  }), [allTasks, committee, department, guideFilter, normalizedQuery, outputFilter, temporalFilter, weekFilter])

  const nextTask = useMemo(() => {
    const scoped = allTasks.filter((task) => (department === 'جميع الأقسام' || task.department === department) && (committee === allCommitteeScopes || task.committee === committee))
    const actionable = scoped.filter((task) => compareLocalDates(now, task.graceEnd) <= 0)
    const candidates = actionable.length ? actionable : scoped
    return [...candidates].sort((a, b) => a.start.getTime() - b.start.getTime() || a.due.getTime() - b.due.getTime())[0] ?? null
  }, [allTasks, committee, department, now])

  const selectedWeekNumber = weekFilter !== 'all' && weekFilter !== '0' && weekFilter !== '16' ? Number(weekFilter) : getRelevantWeek(term, now)
  const selectedWeek = weeks.find((item) => item.number === selectedWeekNumber)
  const examEvent = getExamEvent(term)
  const studyEvent = getStudyEvent(term)
  const semesterStart = parseLocalDate(term.start)
  const committeePlanStart = getCommitteePlanStart(term)
  const firstTaskStart = getWorkStart(term)
  const termElapsed = Math.max(0, Math.min(100, Math.round((differenceInDays(now, semesterStart) / differenceInDays(parseLocalDate(term.end), semesterStart)) * 100)))

  const nextMilestone = nextTask
    ? compareLocalDates(now, nextTask.start) < 0
      ? { label: 'يبدأ التنفيذ بعد', date: nextTask.start }
      : compareLocalDates(now, nextTask.due) <= 0
        ? { label: 'موعد التسليم بعد', date: nextTask.due }
        : compareLocalDates(now, nextTask.graceEnd) <= 0
          ? { label: 'تنتهي مهلة السماح بعد', date: nextTask.graceEnd }
          : { label: 'انتهت نافذة المهمة', date: nextTask.graceEnd }
    : null

  const committeeCards = useMemo(() => Array.from(new Set(allTasks.map((task) => task.committee))).map((name) => {
    const tasks = allTasks.filter((task) => task.committee === name)
    const next = tasks.filter((task) => compareLocalDates(now, task.graceEnd) <= 0).sort((a, b) => a.start.getTime() - b.start.getTime())[0]
    return {
      name,
      tasks,
      next,
      departments: Array.from(new Set(tasks.map((task) => task.department))),
      specialized: name.includes('تخصص'),
      entityType: name === 'جميع اللجان' || name.includes('منسقو') ? 'جهة عمل' : 'لجنة',
    }
  }).sort((a, b) => a.name.localeCompare(b.name, 'ar')), [allTasks, now])

  const activeChips = [
    query && { key: 'query', label: `البحث: ${query}`, clear: () => setQuery('') },
    department !== 'جميع الأقسام' && { key: 'department', label: department, clear: () => setDepartment('جميع الأقسام') },
    committee !== allCommitteeScopes && { key: 'committee', label: committee, clear: () => setCommittee(allCommitteeScopes) },
    weekFilter !== 'all' && { key: 'week', label: weekFilter === '0' ? 'التهيئة' : weekFilter === '16' ? 'الاختبارات' : `الأسبوع ${weekFilter}`, clear: () => setWeekFilter('all') },
    guideFilter !== 'all' && { key: 'guide', label: guideFilter, clear: () => setGuideFilter('all') },
    outputFilter !== 'all' && { key: 'output', label: outputFilter, clear: () => setOutputFilter('all') },
    temporalFilter !== 'all' && { key: 'temporal', label: temporalFilter, clear: () => setTemporalFilter('all') },
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>

  function resetFilters() {
    setQuery('')
    setDepartment('جميع الأقسام')
    setCommittee(allCommitteeScopes)
    setWeekFilter('all')
    setGuideFilter('all')
    setOutputFilter('all')
    setTemporalFilter('all')
  }

  function openTask(task: Task) {
    setSelectedTaskId(task.id)
    window.history.pushState(null, '', `#task=${encodeURIComponent(task.id)}`)
  }

  function closeTask() {
    setSelectedTaskId(null)
    if (window.location.hash.startsWith('#task=')) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  }

  function changeTerm(nextId: string) {
    setTermId(nextId)
    setWeekFilter('all')
    setSelectedTaskId(null)
  }

  function moveWeek(delta: number) {
    if (!weeks.length) return
    const index = Math.max(0, weeks.findIndex((item) => item.number === selectedWeekNumber))
    const nextIndex = Math.max(0, Math.min(weeks.length - 1, index + delta))
    setWeekFilter(String(weeks[nextIndex].number))
  }

  return (
    <div className="app-shell" dir="rtl">
      <div className="reference-banner"><CalendarCheck2 size={17} /> {calendarMeta.title}<span>آخر تحقق: {calendarMeta.reviewedAt}</span></div>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="بوابة أعمال اللجان"><div className="brand-mark"><BookOpenCheck size={23} /></div><div><span>كلية الشريعة والأنظمة</span><strong>بوابة أعمال اللجان</strong></div></a>
        <nav id="main-navigation" className={mobileMenu ? 'topnav is-open' : 'topnav'} aria-label="التنقل الرئيسي">
          <a href="#overview" onClick={() => setMobileMenu(false)}>عملي الآن</a>
          <a href="#tasks" onClick={() => setMobileMenu(false)}>المهام</a>
          <a href="#committees" onClick={() => setMobileMenu(false)}>اللجان</a>
          <a href="#weekly" onClick={() => setMobileMenu(false)}>التقويم</a>
          <a href="#templates" onClick={() => setMobileMenu(false)}>القوالب</a>
          <a className="mobile-sharepoint-link" href={sharePointUrl} target="_blank" rel="noreferrer">SharePoint <ArrowUpLeft size={17} /></a>
        </nav>
        <div className="topbar-actions">
          <a className="sharepoint-button" href={sharePointUrl} target="_blank" rel="noreferrer">مساحة التسليم <ArrowUpLeft size={17} /></a>
          <button className="menu-button" type="button" onClick={() => setMobileMenu(!mobileMenu)} aria-label={mobileMenu ? 'إغلاق القائمة' : 'فتح القائمة'} aria-expanded={mobileMenu} aria-controls="main-navigation"><Menu size={24} /></button>
        </div>
      </header>

      <main id="top">
        <section className="work-hero" id="overview">
          <div className="hero-copy">
            <div className="hero-topline">
              <span className="eyebrow"><CalendarDays size={18} /> {term.academicYear}</span>
              <label className="term-selector"><span>الفصل</span><select value={term.id} onChange={(event) => changeTerm(event.target.value)}>{academicTerms.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select><ChevronDown size={17} /></label>
            </div>
            <span className="section-kicker">عملي الآن</span>
            <h1>ابدأ بالمهمة التالية،<br /><em>وكل ما يلزمها في مكان واحد.</em></h1>
            <p>احفظ نطاقك باختيار القسم واللجنة. لن تعرض البوابة إنجازًا أو تسليمًا فعليًا قبل الربط المباشر مع SharePoint.</p>
            <div className="scope-selectors" aria-label="اختيار نطاق العمل المحفوظ">
              <label><span>قسمي</span><select value={department} onChange={(event) => setDepartment(event.target.value as Department)}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>لجنتي</span><select value={committee} onChange={(event) => setCommittee(event.target.value)}><option value={allCommitteeScopes}>{allCommitteeScopes}</option>{committeeOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            </div>
            <a className="source-note" href={studyEvent.sourceUrl} target="_blank" rel="noreferrer"><ShieldCheck size={19} /><span><strong>{calendarMeta.title}</strong><small>{calendarMeta.displayNote}</small></span><ExternalLink size={17} /></a>
          </div>

          <article className="next-task-card" aria-labelledby="next-task-title">
            <div className="next-task-head"><span><i /> تحديث حي {formatLiveTime(now)}</span><span className="delivery-status">التسليم: بانتظار الربط</span></div>
            {nextTask && nextMilestone ? <>
              <div className="next-task-title"><div><span className="task-code">{nextTask.id}</span><h2 id="next-task-title">مهمتي التالية</h2></div><span className={`status-pill ${temporalClass[nextTask.temporalStatus]}`}>{nextTask.temporalStatus}</span></div>
              <h3>{nextTask.title}</h3>
              <p>{nextTask.committee} · {nextTask.department}</p>
              <div className="next-task-meta"><div><span>المخرج</span><strong>{nextTask.outputType}</strong></div><div><span>الموعد</span><strong>{formatGregorian(nextTask.due)}</strong></div></div>
              <div className="countdown-box"><div><strong>{daysUntil(nextMilestone.date, now)}</strong><span>يومًا</span></div><p><strong>{nextMilestone.label}</strong><span>{formatGregorian(nextMilestone.date, true)}</span></p></div>
              <div className="next-task-actions"><button className="primary-button" type="button" onClick={() => openTask(nextTask)}>كيف أنجزها؟ <ArrowLeft size={18} /></button><a className="secondary-button" href={sharePointUrl} target="_blank" rel="noreferrer">جذر SharePoint <ArrowUpLeft size={18} /></a></div>
            </> : <div className="no-plan"><CalendarClock size={34} /><h2 id="next-task-title">لا توجد خطة لجان صيفية معتمدة</h2><p>الفصل الصيفي ظاهر للتوسع الزمني فقط، ولم يُسند إليه كتالوج مهام محلي.</p></div>}
          </article>
        </section>

        <section className="metrics-grid" aria-label="ملخص النظام">
          <article><div className="metric-icon mint"><ListChecks size={22} /></div><span>سجلات المهام</span><strong>{allTasks.length || '—'}</strong><small>{term.supportsFullCommitteePlan ? 'جميع السجلات مصنفة' : 'لا خطة صيفية محلية'}</small></article>
          <article><div className="metric-icon blue"><FileCheck2 size={22} /></div><span>أنواع المهام</span><strong>{new Set(allTasks.map((task) => task.taskTypeId)).size || '—'}</strong><small>بدليل مركزي قابل لإعادة الاستخدام</small></article>
          <article><div className="metric-icon amber"><FileText size={22} /></div><span>القوالب المركزية</span><strong>{templates.length}</strong><small>Word وExcel</small></article>
          <article><div className="metric-icon violet"><CalendarDays size={22} /></div><span>الأسابيع الفعلية</span><strong>{weeks.length}</strong><small>من أصل {term.plannedOperationalWeeks} قبل الاختبارات</small></article>
        </section>

        <section className="tasks-section" id="tasks">
          <div className="section-heading">
            <div><span className="section-kicker">دليل التنفيذ</span><h2>جميع مهام الفصل</h2><p>ابحث بالعنوان أو رمز المهمة، ثم ضيّق النتائج حسب نطاق العمل والمخرج والحالة الزمنية.</p></div>
            <div className="result-count" aria-live="polite"><strong>{filteredTasks.length}</strong><span>نتيجة مطابقة</span></div>
          </div>

          <div className="filters-panel simple-filters-panel">
            <label className="search-field"><span>البحث في الفصل</span><div><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: QRA-T003 أو خطة الجودة" /></div></label>
            <label><span>القسم</span><select value={department} onChange={(event) => setDepartment(event.target.value as Department)}>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span>اللجنة</span><select value={committee} onChange={(event) => setCommittee(event.target.value)}><option value={allCommitteeScopes}>{allCommitteeScopes}</option>{committeeOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          </div>

          <details className="advanced-filters"><summary>خيارات بحث إضافية <SlidersHorizontal size={18} /></summary><div><label><span>الأسبوع/الفترة</span><select value={weekFilter} onChange={(event) => setWeekFilter(event.target.value)}><option value="all">كل الفصل</option><option value="0">أسبوع التهيئة</option>{weeks.map((item) => <option key={item.number} value={item.number}>الأسبوع {item.number}</option>)}{examEvent && <option value="16">فترة الاختبارات</option>}</select></label><label><span>نوع الدليل</span><select value={guideFilter} onChange={(event) => setGuideFilter(event.target.value)}><option value="all">كل الأدلة</option>{guideOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>نوع المخرج</span><select value={outputFilter} onChange={(event) => setOutputFilter(event.target.value)}><option value="all">كل المخرجات</option>{outputOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>حالة الموعد</span><select value={temporalFilter} onChange={(event) => setTemporalFilter(event.target.value)}><option value="all">كل الحالات</option>{Object.keys(temporalClass).map((item) => <option key={item}>{item}</option>)}</select></label></div></details>

          <div className="active-filters">
            <SlidersHorizontal size={19} />
            {activeChips.length ? activeChips.map((chip) => <button type="button" key={chip.key} onClick={chip.clear}>{chip.label}<X size={16} /></button>) : <span>لا توجد فلاتر نشطة</span>}
            {activeChips.length > 0 && <button className="clear-filters" type="button" onClick={resetFilters}>مسح الكل</button>}
          </div>

          <div className="tasks-list">
            {filteredTasks.slice(0, visibleCount).map((task) => <article className="task-card simple-task-card" key={task.id}>
                <div className="task-card-top"><div><span className="task-code">{task.id}</span>{task.scheduleAdjusted && <span className="adjusted-badge">أعيدت الجدولة</span>}</div></div>
                <h3>{task.title}</h3>
                <p>{task.committee} · {task.department}</p>
                <div className="simple-task-facts"><div><CalendarClock size={19} /><span>الموعد</span><strong>{formatGregorian(task.due)}</strong><small>{task.temporalStatus}</small></div><div><FileCheck2 size={19} /><span>الشاهد الكافي</span><strong>{task.quickEvidence}</strong></div></div>
                <button className="details-button" type="button" onClick={() => openTask(task)}>كيف أنجزها؟ <ChevronLeft size={18} /></button>
              </article>)}
            {!filteredTasks.length && <div className="empty-state"><Search size={34} /><h3>لا توجد مهام مطابقة</h3><p>امسح البحث أو أحد الفلاتر، أو اختر فصلًا آخر.</p><button className="secondary-button" type="button" onClick={resetFilters}>مسح البحث والفلاتر</button></div>}
          </div>
          {visibleCount < filteredTasks.length && <button className="show-more-button" type="button" onClick={() => setVisibleCount((count) => count + 40)}>عرض 40 مهمة إضافية</button>}
        </section>

        <section className="content-section committee-section" id="committees">
          <div className="section-heading"><div><span className="section-kicker">هويات العمل</span><h2>اللجان والجهات مستقلة</h2><p>يعاد استخدام الدليل عند تشابه الإجراء، بينما تبقى اللجنة والتكليف والأدلة منفصلة.</p></div><span className="section-stat">{committeeCards.length} هوية</span></div>
          <div className="governance-note"><UsersRound size={22} /><div><strong>حوكمة التشغيل</strong><p>يتابع المشرف العام رؤساء اللجان، وتبقى سلطة الاعتماد النهائية وفق قرارات الكلية والعميد. المدعو أو الخبير ليس عضوًا، ولا يدخل في النصاب أو التصويت، ولا يسند إليه تكليف لجنة.</p></div></div>
          <div className="committee-grid">{committeeCards.map((card) => <article className={`committee-card ${card.specialized ? 'is-specialized' : ''}`} key={card.name}>
            <div className="committee-card-head"><span>{card.entityType}</span>{card.specialized && <strong>هوية مستقلة</strong>}</div>
            <h3>{card.name}</h3>
            <p>{card.departments.join(' · ')}</p>
            <div className="committee-numbers"><div><strong>{card.tasks.length}</strong><span>مهمة</span></div><div><strong>{new Set(card.tasks.map((task) => task.taskTypeId)).size}</strong><span>نوعًا</span></div></div>
            <div className="committee-next"><span>القادم</span><strong>{card.next?.title ?? 'لا توجد نافذة قادمة'}</strong></div>
            <button type="button" onClick={() => { setCommittee(card.name); setWeekFilter('all'); document.querySelector('#tasks')?.scrollIntoView({ behavior: 'smooth' }) }}>عرض مهامها <ChevronLeft size={18} /></button>
          </article>)}</div>
        </section>

        <section className="content-section calendar-section" id="weekly">
          <div className="section-heading"><div><span className="section-kicker">خارطة الفصل</span><h2>التقويم التشغيلي المرن</h2><p>يتجاوز التوقفات، يحرك الموعد الواقع في إجازة، ويوقف إنشاء الأسابيع قبل الاختبارات.</p></div><div className="calendar-controls"><button type="button" onClick={() => moveWeek(-1)} aria-label="الأسبوع السابق"><ChevronRight size={20} /></button><span>{selectedWeek ? `الأسبوع ${selectedWeek.number}` : 'كل الأسابيع'}</span><button type="button" onClick={() => moveWeek(1)} aria-label="الأسبوع التالي"><ChevronLeft size={20} /></button></div></div>
          {weeks.length < term.plannedOperationalWeeks && <div className="calendar-warning"><AlertTriangle size={20} /><p>المتاح فعليًا {weeks.length} أسبوعًا من أصل {term.plannedOperationalWeeks} مخططًا؛ أوقف النظام الأسابيع المتبقية قبل بدء الاختبارات.</p></div>}
          <div className="orientation-band"><CalendarCheck2 size={21} /><div><strong>{term.orientationDays ? 'أسبوع تهيئة أعمال اللجان' : 'لا توجد تهيئة منفصلة'}</strong><span>{formatShortDate(committeePlanStart)} - {formatShortDate(addDays(committeePlanStart, Math.max(term.orientationDays - 1, 0)))}</span></div>{term.supportsFullCommitteePlan && <button type="button" onClick={() => setWeekFilter('0')}>عرض مهام التهيئة</button>}</div>
          <div className="week-track" ref={weekTrackRef} aria-label="الأسابيع التشغيلية">
            {weeks.map((item) => <button type="button" data-week={item.number} className={`week-item ${String(item.number) === weekFilter ? 'is-active' : ''} ${compareLocalDates(now, item.graceEnd) > 0 ? 'is-past' : ''}`} key={item.number} onClick={() => setWeekFilter(String(item.number))} aria-pressed={String(item.number) === weekFilter}>
              <div><span>الأسبوع {item.number}</span><strong>{formatShortDate(item.due)}</strong></div>
              <p>{formatShortDate(item.start)} - {formatShortDate(item.end)}</p>
              <small>{item.event?.label ?? `المهلة حتى ${formatShortDate(item.graceEnd)}`}</small>
            </button>)}
          </div>
          <div className="calendar-facts"><span><CalendarDays size={18} /> بداية الدراسة الأكاديمية: {formatGregorian(semesterStart, true)}</span><span><CalendarClock size={18} /> بداية أعمال اللجان: {formatGregorian(committeePlanStart, true)}</span><span><CalendarCheck2 size={18} /> أول أسبوع تشغيلي: {formatGregorian(firstTaskStart, true)}</span>{examEvent && <button type="button" onClick={() => setWeekFilter('16')}><CalendarCheck2 size={18} /> الاختبارات: {formatGregorian(parseLocalDate(examEvent.start))} - {formatGregorian(parseLocalDate(examEvent.end), true)}</button>}<span><ShieldCheck size={18} /> الموضع الزمني داخل الفصل: {termElapsed}% — لا يمثل الإنجاز</span></div>

          <details className="calendar-sources">
            <summary>مراجع أحداث هذا الفصل <ChevronDown size={19} /></summary>
            <div>{term.events.map((event) => <article key={event.eventId}>
              <div><span>{event.eventType === 'study' ? 'دراسة' : event.eventType === 'exams' ? 'اختبارات' : 'توقف'}</span><strong>{event.label}</strong></div>
              <p>{formatGregorian(parseLocalDate(event.start), true)}{event.start !== event.end ? ` - ${formatGregorian(parseLocalDate(event.end), true)}` : ''}</p>
              <p>{event.sourceLocator}</p>
              <a href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceTitle} · {event.issuingAuthority} <ExternalLink size={16} /></a>
            </article>)}</div>
            <p className="source-review">المراجعة التالية: {calendarMeta.reviewDueAt}. تُراجع إعدادات التقويم دوريًا من ملف الإعداد المركزي.</p>
          </details>
        </section>

        <section className="content-section department-section" id="departments">
          <div className="section-heading"><div><span className="section-kicker">نظرة إشرافية</span><h2>الأقسام المشمولة</h2><p>تظهر أعداد السجلات فقط؛ لا تعرض نسب إنجاز غير مرتبطة بمصدر حي.</p></div><a className="text-button" href={powerBiUrl} target="_blank" rel="noreferrer">فتح لوحة المتابعة <ArrowUpLeft size={18} /></a></div>
          <div className="department-grid">{departmentDetails().map((item) => {
            const count = allTasks.filter((task) => task.department === item.name).length
            return <article className="department-card" key={item.name} style={{ '--department-accent': departmentAccents[item.name] } as CSSProperties}><span className="department-code">{item.code}</span><strong className="department-count">{count}</strong><h3>{item.name}</h3><div><span>تنسيق السجل <strong>{item.coordinator}</strong></span><span>مراجعة القسم <strong>{item.head}</strong></span></div><button type="button" onClick={() => { setDepartment(item.name); document.querySelector('#tasks')?.scrollIntoView({ behavior: 'smooth' }) }}>عرض مهام القسم <ChevronLeft size={18} /></button></article>
          })}</div>
        </section>

        <section className="templates-section" id="templates">
          <div className="templates-intro"><span className="section-kicker section-kicker-light">مكتبة العمل</span><h2>14 قالبًا مركزيًا، لا صفحة فارغة.</h2><p>يعرض كل قالب غرضه وطريقة استخدامه وفحص الجودة. تتولى مكتبة المستندات النهائية حفظ النسخ المعتمدة.</p><a className="light-button" href="#template-library">استعرض المكتبة <ArrowLeft size={18} /></a></div>
          <div className="templates-grid" id="template-library">{templates.map((template) => <article className="template-card" key={template.id}><div className={`file-icon ${template.type.toLowerCase()}`}><FileText size={23} /></div><button type="button" onClick={() => setSelectedTemplate(template.id)}><span>{template.category} · إصدار {template.version}</span><h3>{template.name}</h3><small>{template.description}</small></button><a href={`/templates/${template.file}`} download aria-label={`تحميل ${template.name}`}><Download size={19} /></a></article>)}</div>
        </section>

        <section className="workflow-section">
          <div className="workflow-heading"><span className="section-kicker">مسار بسيط</span><h2>من المهمة إلى شاهد مكتمل</h2><p>افتح المهمة، نفّذ خطواتها القصيرة، واحتفظ بالشاهد المحدد فقط.</p></div>
          <div className="workflow-steps"><div><span>01</span><LayoutDashboard size={24} /><h3>افتح المهمة</h3><p>اعرف المطلوب ومن سينفّذه.</p></div><div><span>02</span><ListChecks size={24} /><h3>نفّذ الخطوات</h3><p>اتبع الخطوات الثلاث كما تظهر.</p></div><div><span>03</span><ClipboardCheck size={24} /><h3>احفظ الشاهد</h3><p>اكتفِ بالشاهد المحدد للمهمة.</p></div><div><span>04</span><FolderOpen size={24} /><h3>ارفع الناتج</h3><p>استخدم المسار المؤسسي عند تهيئته.</p></div></div>
        </section>
      </main>

      <footer className="site-footer"><div className="brand"><div className="brand-mark"><BookOpenCheck size={22} /></div><div><span>كلية الشريعة والأنظمة</span><strong>بوابة أعمال اللجان</strong></div></div><p>{calendarMeta.title} · تبقى حالة التسليم بانتظار الربط</p><a href={sharePointUrl} target="_blank" rel="noreferrer">فتح SharePoint <ExternalLink size={17} /></a></footer>
      {selectedTask && <TaskModal task={selectedTask} onClose={closeTask} />}
      {selectedTemplate && <TemplateModal templateId={selectedTemplate} onClose={() => setSelectedTemplate(null)} />}
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('committee-portal-access') === 'granted')
  return unlocked ? <Dashboard /> : <AccessGate onUnlock={() => setUnlocked(true)} />
}
