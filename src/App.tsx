import { FormEvent, useMemo, useState } from 'react'
import {
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
  CircleAlert,
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
  Sparkles,
  Target,
  UsersRound,
  X,
} from 'lucide-react'
import {
  academicTerms,
  addDays,
  buildOperationalWeeks,
  daysUntil,
  formatGregorian,
  formatHijri,
  formatShortDate,
  getDefaultTerm,
  getRelevantWeek,
  getWorkStart,
  parseLocalDate,
} from './academicCalendar'
import { buildTasksForTerm, Department, departments, Status, Task, templateById, templates } from './data'

const sharePointUrl = 'https://taifedusa.sharepoint.com/sites/CommitteeQuality'
const powerBiUrl = 'https://app.powerbi.com/groups/me/reports/aa400403-e1d0-41df-8cc2-e99de8624584/64c51bcc9d1370803690?experience=power-bi'

const departmentMeta = [
  { name: 'قسم القراءات', coordinator: 'آمنة قحاف', head: 'عبدالعزيز الأنصاري', accent: '#17685d' },
  { name: 'قسم الثقافة الإسلامية', coordinator: 'هبة القرشي', head: 'فيصل الشمراني', accent: '#bd8a3d' },
  { name: 'قسم الشريعة', coordinator: 'خلود العصيمي', head: 'خالد الغامدي', accent: '#6b5aa7' },
  { name: 'قسم الأنظمة', coordinator: 'نزار الفطناسي', head: 'مهنا الزهراني', accent: '#2d78a0' },
]

const statusClass: Record<Status, string> = {
  قادم: 'status-upcoming',
  مفتوح: 'status-progress',
  'فترة سماح': 'status-grace',
  متأخر: 'status-attention',
}

function normalizeDigits(value: string) {
  return value
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
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
      <div className="access-glow access-glow-one" />
      <div className="access-glow access-glow-two" />
      <section className="access-shell">
        <div className="access-brand">
          <div className="brand-mark brand-mark-light" aria-hidden="true"><BookOpenCheck size={25} /></div>
          <div><span>كلية الشريعة والأنظمة</span><strong>بوابة أعمال اللجان</strong></div>
        </div>
        <div className="access-copy">
          <span className="eyebrow eyebrow-light"><ShieldCheck size={16} /> مساحة عمل منظمة وآمنة</span>
          <h1>من المهمة الأسبوعية<br />إلى دليلٍ يُعتد به.</h1>
          <p>تقويم جامعي فعلي، مهام واضحة، وقوالب موحدة تساعد فرق اللجان على إنتاج ملفات دقيقة قابلة للمراجعة والاستشهاد.</p>
          <div className="access-features">
            <span><Check size={17} /> عد تنازلي تلقائي</span>
            <span><Check size={17} /> قوالب قابلة للتحميل</span>
            <span><Check size={17} /> تسليم نهائي عبر SharePoint</span>
          </div>
        </div>
        <p className="access-footnote">العام الجامعي 1448-1449هـ</p>
      </section>
      <section className="access-form-wrap">
        <form className="access-card" onSubmit={submit}>
          <div className="access-icon"><LockKeyhole size={25} /></div>
          <span className="access-kicker">دخول أعضاء اللجان</span>
          <h2>مرحبًا بعودتك</h2>
          <p>أدخل رمز الوصول لمشاهدة التقويم والمهام والقوالب.</p>
          <label htmlFor="access-code">رمز الوصول</label>
          <div className={`code-field ${error ? 'has-error' : ''}`}>
            <KeyRound size={19} />
            <input id="access-code" type="password" inputMode="numeric" autoComplete="current-password" placeholder="أدخل الرمز" value={code} onChange={(event) => { setCode(event.target.value); setError(false) }} aria-invalid={error} />
          </div>
          {error && <span className="form-error"><CircleAlert size={15} /> رمز الوصول غير صحيح</span>}
          <button className="primary-button access-button" type="submit">دخول البوابة <ArrowLeft size={18} /></button>
          <div className="access-note"><ShieldCheck size={17} /><span>يقبل الرمز بالأرقام العربية أو الإنجليزية. هذه حماية للنسخة التجريبية.</span></div>
        </form>
      </section>
    </main>
  )
}

function CountdownRing({ days, label }: { days: number; label: string }) {
  const progress = Math.max(35, Math.min(92, 100 - (days / 30) * 100))
  return (
    <div className="progress-ring countdown-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{days}</strong><span>{label}</span></div>
    </div>
  )
}

function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const template = templateById(task.templateId)
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
          <div><span className="task-code">{task.id}</span><h2 id="task-modal-title">{task.title}</h2><p>{task.committee} · {task.department}</p></div>
        </header>
        <div className="modal-content">
          <div className="modal-summary">
            <div><span>بدء التنفيذ</span><strong>{formatGregorian(task.start)}</strong></div>
            <div><span>المخرج الإلزامي</span><strong>{task.deliverable}</strong></div>
            <div><span>التسليم الأساسي</span><strong>{formatGregorian(task.due)}</strong></div>
          </div>
          <div className="timing-callout"><CalendarClock size={18} /><span>{task.timingNote}. تنتهي مهلة السماح في {formatGregorian(task.graceEnd)}.</span></div>
          <section className="modal-section"><div className="section-icon"><Target size={19} /></div><div><h3>الهدف من المهمة</h3><p>{task.objective}</p></div></section>
          <section className="modal-section modal-section-stack">
            <div className="section-title"><ListChecks size={19} /><h3>طريقة الإنجاز</h3></div>
            <ol className="steps-list">{task.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol>
          </section>
          <section className="modal-section modal-section-stack">
            <div className="section-title"><ClipboardCheck size={19} /><h3>فحص الجودة قبل التسليم</h3></div>
            <ul className="check-list">{task.checklist.map((item) => <li key={item}><CheckCircle2 size={18} /><span>{item}</span></li>)}</ul>
          </section>
          <div className="template-callout">
            <div><FileText size={22} /><span><small>القالب الأنسب</small><strong>{template.name}</strong></span></div>
            <a href={`/templates/${template.file}`} download>تحميل القالب <Download size={16} /></a>
          </div>
        </div>
      </section>
    </div>
  )
}

function TemplateModal({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const template = templateById(templateId)
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="task-modal template-modal" role="dialog" aria-modal="true" aria-labelledby="template-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header"><button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button><div><span className="task-code">{template.category} · إصدار {template.version}</span><h2 id="template-modal-title">{template.name}</h2><p>{template.description}</p></div></header>
        <div className="modal-content">
          <section className="modal-section"><div className="section-icon"><Info size={19} /></div><div><h3>متى يستخدم؟</h3><p>{template.whenToUse}</p></div></section>
          <section className="modal-section modal-section-stack"><div className="section-title"><ListChecks size={19} /><h3>طريقة الاستخدام</h3></div><ol className="steps-list">{template.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section>
          <section className="modal-section modal-section-stack"><div className="section-title"><ClipboardCheck size={19} /><h3>علامات القالب المكتمل</h3></div><ul className="check-list">{template.qualityChecks.map((item) => <li key={item}><CheckCircle2 size={18} /><span>{item}</span></li>)}</ul></section>
          <a className="primary-button modal-download" href={`/templates/${template.file}`} download><Download size={18} /> تحميل {template.type === 'Word' ? 'ملف Word' : 'ملف Excel'}</a>
        </div>
      </section>
    </div>
  )
}

function Dashboard() {
  const today = useMemo(() => new Date(), [])
  const initialTerm = useMemo(() => getDefaultTerm(today), [today])
  const [termId, setTermId] = useState(initialTerm.id)
  const term = academicTerms.find((item) => item.id === termId) ?? initialTerm
  const weeks = useMemo(() => buildOperationalWeeks(term), [term])
  const [week, setWeek] = useState(() => getRelevantWeek(initialTerm, today))
  const [department, setDepartment] = useState<Department>('جميع الأقسام')
  const [query, setQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)

  const allTasks = useMemo(() => buildTasksForTerm(term, today), [term, today])
  const filteredTasks = useMemo(() => allTasks.filter((task) => {
    const matchesDepartment = department === 'جميع الأقسام' || task.department === department
    const haystack = `${task.title} ${task.committee} ${task.deliverable}`
    return matchesDepartment && task.week === week && haystack.includes(query.trim())
  }), [allTasks, department, query, week])

  const firstTaskStart = getWorkStart(term)
  const semesterStart = parseLocalDate(term.start)
  const daysToFirstTask = daysUntil(firstTaskStart, today)
  const daysToSemester = daysUntil(semesterStart, today)
  const selectedWeek = weeks.find((item) => item.number === week)
  const upcomingWeek = weeks.find((item) => today <= item.graceEnd) ?? weeks[weeks.length - 1]
  const selectedStatusCounts = filteredTasks.reduce<Record<Status, number>>((counts, task) => ({ ...counts, [task.status]: counts[task.status] + 1 }), { قادم: 0, مفتوح: 0, 'فترة سماح': 0, متأخر: 0 })
  const termElapsed = Math.max(0, Math.min(100, Math.round(((today.getTime() - semesterStart.getTime()) / (parseLocalDate(term.end).getTime() - semesterStart.getTime())) * 100)))

  function changeTerm(nextId: string) {
    const nextTerm = academicTerms.find((item) => item.id === nextId) ?? term
    setTermId(nextId)
    setWeek(getRelevantWeek(nextTerm, today))
  }

  return (
    <div className="app-shell" dir="rtl">
      <div className="demo-banner"><CalendarCheck2 size={14} /> التقويم فعلي ومتحرك زمنيًا · بيانات الإنجاز تظهر بعد الربط المباشر مع SharePoint</div>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="بوابة أعمال اللجان"><div className="brand-mark"><BookOpenCheck size={23} /></div><div><span>كلية الشريعة والأنظمة</span><strong>بوابة أعمال اللجان</strong></div></a>
        <nav className={mobileMenu ? 'topnav is-open' : 'topnav'} aria-label="التنقل الرئيسي">
          <a href="#overview" onClick={() => setMobileMenu(false)}>الرئيسية</a><a href="#weekly" onClick={() => setMobileMenu(false)}>التقويم</a><a href="#tasks" onClick={() => setMobileMenu(false)}>المهام</a><a href="#templates" onClick={() => setMobileMenu(false)}>القوالب</a><a href="#departments" onClick={() => setMobileMenu(false)}>الأقسام</a>
        </nav>
        <div className="topbar-actions"><a className="sharepoint-button" href={sharePointUrl} target="_blank" rel="noreferrer">مساحة التسليم <ArrowUpLeft size={16} /></a><button className="menu-button" type="button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="فتح القائمة"><Menu size={22} /></button></div>
      </header>

      <main id="top">
        <section className="hero" id="overview">
          <div className="hero-content">
            <div className="hero-topline">
              <span className="eyebrow"><CalendarDays size={16} /> {term.academicYear}</span>
              <label className="term-selector"><span>الفصل</span><select value={term.id} onChange={(event) => changeTerm(event.target.value)}>{academicTerms.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select><ChevronDown size={15} /></label>
            </div>
            <h1>{today < firstTaskStart ? 'استعد الآن،' : `الأسبوع ${upcomingWeek.number}،`}<br /><em>{today < firstTaskStart ? `فالعمل يبدأ بعد ${daysToFirstTask} يومًا.` : 'والموعد محسوب بدقة.'}</em></h1>
            <p>تبدأ الدراسة في {formatGregorian(semesterStart, true)}، ويُخصص الأسبوع الأول للتهيئة. تنطلق المهام الإلزامية في {formatGregorian(firstTaskStart, true)}، مع مهلة سماح ثابتة قدرها {term.graceDays} أيام بعد الموعد الأساسي.</p>
            <div className="hero-actions"><a className="primary-button" href="#tasks">استعرض أول المهام <ArrowLeft size={18} /></a><a className="secondary-button" href="#templates"><Download size={17} /> حمّل القوالب</a></div>
            <a className="source-note" href={term.officialSourceUrl} target="_blank" rel="noreferrer"><ShieldCheck size={17} /><span><strong>المصدر الزمني:</strong> {term.officialSourceLabel}<small>{term.verificationNote}</small></span><ExternalLink size={15} /></a>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-head"><div><span>الحدث القادم</span><strong>{today < semesterStart ? 'بداية الفصل الدراسي' : today < firstTaskStart ? 'انطلاق مهام اللجان' : `تسليم الأسبوع ${upcomingWeek.number}`}</strong></div><span className="live-pill"><i /> محسوب اليوم</span></div>
            <div className="hero-progress">
              <CountdownRing days={today < semesterStart ? daysToSemester : today < firstTaskStart ? daysToFirstTask : daysUntil(upcomingWeek.due, today)} label="يومًا" />
              <div className="date-breakdown">
                <div><span>بداية الدراسة</span><strong>{formatGregorian(semesterStart)}</strong><small>{formatHijri(semesterStart)}</small></div>
                <div><span>أول مهمة إلزامية</span><strong>{formatGregorian(firstTaskStart)}</strong><small>بعد أسبوع التهيئة</small></div>
                <div><span>نهاية الفصل</span><strong>{formatGregorian(parseLocalDate(term.end), true)}</strong><small>وفق المرجع الرسمي</small></div>
              </div>
            </div>
            <div className="hero-quality"><div className="quality-icon"><CalendarClock size={20} /></div><div><span>الموضع الزمني داخل الفصل</span><strong>{termElapsed}%</strong></div><span className="quality-trend">لا يمثل الإنجاز</span></div>
          </div>
        </section>

        <section className="metrics-grid" aria-label="ملخص الخطة">
          <article className="metric-card"><div className="metric-icon mint"><ListChecks size={21} /></div><div><span>سجلات المهام</span><strong>{allTasks.length}</strong><small>تشمل التحضير والاختبارات</small></div></article>
          <article className="metric-card"><div className="metric-icon blue"><CalendarDays size={21} /></div><div><span>أسابيع التنفيذ</span><strong>{term.operationalWeeks}</strong><small>مع تجاوز الإجازات</small></div></article>
          <article className="metric-card"><div className="metric-icon amber"><Clock3 size={21} /></div><div><span>حتى أول مهمة</span><strong>{daysToFirstTask}</strong><small>يومًا من تاريخ اليوم</small></div></article>
          <article className="metric-card"><div className="metric-icon rose"><ShieldCheck size={21} /></div><div><span>مهلة السماح</span><strong>{term.graceDays}</strong><small>أيام بعد الموعد</small></div></article>
        </section>

        <section className="content-section" id="weekly">
          <div className="section-heading"><div><span className="section-kicker">خارطة الفصل</span><h2>التقويم التشغيلي المرن</h2><p>الأسبوع الأول الجامعي للتهيئة، ثم 15 أسبوعًا للمهام. الإجازة الممتدة تُتجاوز تلقائيًا.</p></div><div className="week-legend"><span><i className="done" /> مضى زمنيًا</span><span><i className="now" /> محدد</span><span><i className="later" /> قادم</span></div></div>
          <div className="orientation-band"><CalendarCheck2 size={20} /><div><strong>أسبوع التهيئة غير المقيم</strong><span>{formatShortDate(semesterStart)} - {formatShortDate(addDays(semesterStart, 6))}</span></div><button type="button" onClick={() => setWeek(0)}>عرض قائمة التحضير</button></div>
          <div className="week-track dynamic-week-track">
            {weeks.map((item) => {
              const elapsed = today > item.graceEnd
              return <button type="button" className={`week-item ${elapsed ? 'is-done' : ''} ${item.number === week ? 'is-active' : ''} ${today < item.start ? 'is-future' : ''}`} key={item.number} onClick={() => setWeek(item.number)} aria-pressed={item.number === week}>
                <div className="week-top"><span>الأسبوع {item.number}</span><strong>{formatShortDate(item.due)}</strong></div><div className="week-date-line">{formatShortDate(item.start)} - {formatShortDate(item.end)}</div><strong className="week-label">التسليم الخميس</strong><small>{item.event ?? `السماح حتى ${formatShortDate(item.graceEnd)}`}</small>
              </button>
            })}
          </div>
          <div className="calendar-facts"><span><CalendarClock size={17} /> الاختبارات: {formatGregorian(parseLocalDate(term.examsStart))} - {formatGregorian(parseLocalDate(term.examsEnd), true)}</span><span><ShieldCheck size={17} /> المصدر موثق ومراجع بتاريخ 18 أغسطس 2026</span></div>
        </section>

        <section className="content-section tasks-section" id="tasks">
          <div className="section-heading tasks-heading">
            <div><span className="section-kicker">دليل التنفيذ</span><h2>{week === 0 ? 'قائمة تهيئة اللجان' : week === 16 ? 'مهام فترة الاختبارات' : `مهام الأسبوع ${week}`}</h2><p>{selectedWeek ? `${formatGregorian(selectedWeek.start)} - ${formatGregorian(selectedWeek.end)} · التسليم ${formatGregorian(selectedWeek.due)}` : 'مهام تحضيرية لا تدخل في تقييم الالتزام'}</p></div>
            <div className="task-tools"><label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في المهام" /></label><label className="select-box"><UsersRound size={18} /><select value={department} onChange={(event) => setDepartment(event.target.value as Department)}>{departments.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label></div>
          </div>
          <div className="task-summary"><span><strong>{filteredTasks.length}</strong> مهمة ظاهرة</span><span><i className="dot green" /><strong>{selectedStatusCounts['مفتوح']}</strong> مفتوحة</span><span><i className="dot gold" /><strong>{selectedStatusCounts['فترة سماح']}</strong> ضمن السماح</span><span><i className="dot red" /><strong>{selectedStatusCounts['متأخر']}</strong> متأخرة زمنيًا</span><span className="summary-progress"><Info size={16} /> الحالة هنا زمنية وليست إثبات إنجاز</span></div>
          <div className="tasks-list">
            {filteredTasks.map((task) => {
              const template = templateById(task.templateId)
              return <article className="task-row" key={task.id}>
                <div className="task-primary"><div className={`task-state ${statusClass[task.status]}`}>{task.status === 'متأخر' ? <CircleAlert size={20} /> : task.status === 'مفتوح' ? <CalendarCheck2 size={20} /> : <Clock3 size={20} />}</div><div><span className="task-code">{task.id}</span><h3>{task.title}</h3><p>{task.committee} · {task.department}</p></div></div>
                <div className="task-deliverable"><span>المخرج المطلوب</span><strong>{task.outputType}</strong><small>{template.name}</small></div>
                <div className="task-due"><span>التسليم الأساسي</span><strong>{formatGregorian(task.due)}</strong><small>السماح حتى {formatGregorian(task.graceEnd)}</small></div>
                <div className="task-progress-cell"><span>الحالة الزمنية</span><strong className={`inline-status ${statusClass[task.status]}`}>{task.status}</strong><small>يبدأ {formatGregorian(task.start)}</small></div>
                <button className="details-button" type="button" onClick={() => setSelectedTask(task)}>الشرح والقالب <ChevronLeft size={17} /></button>
              </article>
            })}
            {!filteredTasks.length && <div className="empty-state"><Search size={30} /><h3>لا توجد مهام مطابقة</h3><p>جرّب اختيار أسبوع أو قسم آخر.</p></div>}
          </div>
          <button className="exam-tasks-button" type="button" onClick={() => setWeek(16)}><CalendarClock size={18} /> عرض مهام فترة الاختبارات ({allTasks.filter((task) => task.week === 16).length})</button>
        </section>

        <section className="content-section department-section" id="departments">
          <div className="section-heading"><div><span className="section-kicker">نظرة إشرافية</span><h2>الأقسام المشمولة</h2><p>أعداد المهام حقيقية من سجل المتابعة؛ نسب الإنجاز لا تُعرض قبل وصول بيانات SharePoint.</p></div><a className="text-button" href={powerBiUrl} target="_blank" rel="noreferrer">فتح لوحة المتابعة <ArrowUpLeft size={17} /></a></div>
          <div className="department-grid">{departmentMeta.map((item, index) => {
            const count = allTasks.filter((task) => task.department === item.name).length
            return <article className="department-card" key={item.name} style={{ '--department-accent': item.accent } as React.CSSProperties}><div className="department-head"><div className="department-number">0{index + 1}</div><span className="department-score">{count}</span></div><h3>{item.name}</h3><div className="department-people"><span>المنسق <strong>{item.coordinator}</strong></span><span>رئيس القسم <strong>{item.head}</strong></span></div><div className="department-progress neutral-progress"><i /></div><div className="department-foot"><span>مهمة مجدولة</span><button type="button" onClick={() => { setDepartment(item.name as Department); document.querySelector('#tasks')?.scrollIntoView({ behavior: 'smooth' }) }}>عرض المهام <ChevronLeft size={15} /></button></div></article>
          })}</div>
        </section>

        <section className="content-section templates-section" id="templates">
          <div className="templates-intro"><span className="section-kicker section-kicker-light">مكتبة العمل</span><h2>لا تبدأ من صفحة فارغة.</h2><p>سبعة قوالب فعلية قابلة للتحميل، صُممت بحيث تنتج ملفًا كاملًا موثقًا لا مجرد ورقة شكلية.</p><a className="light-button" href="#template-library">استعرض جميع القوالب <ArrowLeft size={17} /></a></div>
          <div className="templates-grid" id="template-library">{templates.map((template) => <article className="template-card" key={template.id}><div className={`file-icon ${template.type.toLowerCase()}`}><FileText size={22} /></div><button className="template-copy" type="button" onClick={() => setSelectedTemplate(template.id)}><span>{template.category} · إصدار {template.version}</span><h3>{template.name}</h3><small>{template.description}</small></button><a href={`/templates/${template.file}`} download aria-label={`تحميل ${template.name}`}><Download size={18} /></a></article>)}</div>
        </section>

        <section className="workflow-section">
          <div className="workflow-heading"><span className="section-kicker">مسار العمل</span><h2>من التكليف إلى الدليل</h2><p>الموقع يشرح ويوجّه، وSharePoint يحتفظ بالملف النهائي ويغذي لوحة المتابعة.</p></div>
          <div className="workflow-steps"><div><span>01</span><div className="workflow-icon"><LayoutDashboard size={21} /></div><h3>راجع الموعد</h3><p>العد التنازلي والتاريخ يتغيران تلقائيًا.</p></div><i /><div><span>02</span><div className="workflow-icon"><FileCheck2 size={21} /></div><h3>استخدم القالب</h3><p>اتبع الشرح وقائمة الفحص.</p></div><i /><div><span>03</span><div className="workflow-icon"><ClipboardCheck size={21} /></div><h3>افحص الجودة</h3><p>تحقق من الدليل والتحليل والاعتماد.</p></div><i /><div><span>04</span><div className="workflow-icon"><FolderOpen size={21} /></div><h3>سلّم نهائيًا</h3><p>ارفع النسخة المعتمدة في SharePoint.</p></div></div>
        </section>
      </main>

      <footer><div className="brand footer-brand"><div className="brand-mark"><BookOpenCheck size={22} /></div><div><span>كلية الشريعة والأنظمة</span><strong>بوابة أعمال اللجان</strong></div></div><p>التقويم مرن ومبني من ملف إعداد مستقل · تبقى النسخ المعتمدة داخل SharePoint</p><a href={sharePointUrl} target="_blank" rel="noreferrer">الدخول إلى SharePoint <ExternalLink size={15} /></a></footer>
      {selectedTask && <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
      {selectedTemplate && <TemplateModal templateId={selectedTemplate} onClose={() => setSelectedTemplate(null)} />}
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('committee-portal-access') === 'granted')
  return unlocked ? <Dashboard /> : <AccessGate onUnlock={() => setUnlocked(true)} />
}
