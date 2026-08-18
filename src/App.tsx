import { FormEvent, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpLeft,
  Award,
  BarChart3,
  BellRing,
  BookOpenCheck,
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
  Gauge,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UsersRound,
  X,
} from 'lucide-react'
import { Department, departments, Task, tasks, templates, weeklyProgress } from './data'

const sharePointUrl = 'https://taifedusa.sharepoint.com/sites/CommitteeQuality'
const powerBiUrl = 'https://app.powerbi.com/groups/me/reports/aa400403-e1d0-41df-8cc2-e99de8624584/64c51bcc9d1370803690?experience=power-bi'
const currentWeek = 4

const departmentMeta = [
  { name: 'قسم القراءات', coordinator: 'آمنة قحاف', head: 'عبدالعزيز الأنصاري', progress: 68, accent: '#17685d' },
  { name: 'قسم الثقافة الإسلامية', coordinator: 'هبة القرشي', head: 'فيصل الشمراني', progress: 57, accent: '#bd8a3d' },
  { name: 'قسم الشريعة', coordinator: 'خلود العصيمي', head: 'خالد الغامدي', progress: 49, accent: '#6b5aa7' },
  { name: 'قسم الأنظمة', coordinator: 'نزار الفطناسي', head: 'مهنا الزهراني', progress: 82, accent: '#2d78a0' },
]

const statusClass: Record<Task['status'], string> = {
  مكتمل: 'status-complete',
  'قيد التنفيذ': 'status-progress',
  قادم: 'status-upcoming',
  'يحتاج انتباهًا': 'status-attention',
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
          <div className="brand-mark brand-mark-light" aria-hidden="true">
            <BookOpenCheck size={25} />
          </div>
          <div>
            <span>كلية الشريعة والأنظمة</span>
            <strong>بوابة أعمال اللجان</strong>
          </div>
        </div>

        <div className="access-copy">
          <span className="eyebrow eyebrow-light"><ShieldCheck size={16} /> مساحة عمل منظمة وآمنة</span>
          <h1>من المهمة الأسبوعية<br />إلى دليلٍ يُعتد به.</h1>
          <p>خطة واضحة، قوالب موحدة، ومؤشرات تساعد فرق اللجان على إنجاز أعمال دقيقة قابلة للاستشهاد في تقارير الجودة.</p>
          <div className="access-features">
            <span><Check size={17} /> مهام أسبوعية واضحة</span>
            <span><Check size={17} /> متابعة الإنجاز والجودة</span>
            <span><Check size={17} /> تسليم نهائي عبر SharePoint</span>
          </div>
        </div>

        <p className="access-footnote">الفصل الدراسي الأول · 1448هـ</p>
      </section>

      <section className="access-form-wrap">
        <form className="access-card" onSubmit={submit}>
          <div className="access-icon"><LockKeyhole size={25} /></div>
          <span className="access-kicker">دخول أعضاء اللجان</span>
          <h2>مرحبًا بعودتك</h2>
          <p>أدخل رمز الوصول لمشاهدة الخطة والمهام والقوالب.</p>

          <label htmlFor="access-code">رمز الوصول</label>
          <div className={`code-field ${error ? 'has-error' : ''}`}>
            <KeyRound size={19} />
            <input
              id="access-code"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="أدخل الرمز"
              value={code}
              onChange={(event) => {
                setCode(event.target.value)
                setError(false)
              }}
              aria-invalid={error}
            />
          </div>
          {error && <span className="form-error"><CircleAlert size={15} /> رمز الوصول غير صحيح</span>}
          <button className="primary-button access-button" type="submit">
            دخول البوابة <ArrowLeft size={18} />
          </button>
          <div className="access-note">
            <ShieldCheck size={17} />
            <span>يقبل الرمز بالأرقام العربية أو الإنجليزية. هذه حماية للنسخة التجريبية.</span>
          </div>
        </form>
      </section>
    </main>
  )
}

function ProgressRing({ value }: { value: number }) {
  return (
    <div className="progress-ring" style={{ '--progress': `${value * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{value}%</strong><span>منجز</span></div>
    </div>
  )
}

function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <button className="icon-button" type="button" onClick={onClose} aria-label="إغلاق"><X size={20} /></button>
          <div>
            <span className="task-code">{task.id}</span>
            <h2 id="task-modal-title">{task.title}</h2>
            <p>{task.committee} · {task.department}</p>
          </div>
        </header>
        <div className="modal-content">
          <div className="modal-summary">
            <div><span>موعد التسليم</span><strong>{task.due}</strong></div>
            <div><span>المخرج المطلوب</span><strong>{task.deliverable}</strong></div>
            <div><span>نسبة الإنجاز</span><strong>{task.progress}%</strong></div>
          </div>
          <section className="modal-section">
            <div className="section-icon"><Target size={19} /></div>
            <div><h3>الهدف من المهمة</h3><p>{task.objective}</p></div>
          </section>
          <section className="modal-section modal-section-stack">
            <div className="section-title"><ListChecks size={19} /><h3>طريقة الإنجاز</h3></div>
            <ol className="steps-list">
              {task.steps.map((step, index) => <li key={step}><span>{index + 1}</span><p>{step}</p></li>)}
            </ol>
          </section>
          <section className="modal-section modal-section-stack">
            <div className="section-title"><ClipboardCheck size={19} /><h3>فحص الجودة قبل التسليم</h3></div>
            <ul className="check-list">
              {task.checklist.map((item) => <li key={item}><CheckCircle2 size={18} /><span>{item}</span></li>)}
            </ul>
          </section>
          <div className="template-callout">
            <div><FileText size={22} /><span><small>القالب المرتبط</small><strong>{task.template}</strong></span></div>
            <a href={sharePointUrl} target="_blank" rel="noreferrer">فتح مساحة القوالب <ExternalLink size={16} /></a>
          </div>
        </div>
      </section>
    </div>
  )
}

function Dashboard() {
  const [department, setDepartment] = useState<Department>('جميع الأقسام')
  const [week, setWeek] = useState(currentWeek)
  const [query, setQuery] = useState('')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesDepartment = department === 'جميع الأقسام' || task.department === department || task.department === 'جميع الأقسام'
    const matchesWeek = task.week === week
    const haystack = `${task.title} ${task.committee} ${task.deliverable}`
    return matchesDepartment && matchesWeek && haystack.includes(query.trim())
  }), [department, query, week])

  const completed = filteredTasks.filter((task) => task.status === 'مكتمل').length
  const active = filteredTasks.filter((task) => task.status === 'قيد التنفيذ').length
  const attention = filteredTasks.filter((task) => task.status === 'يحتاج انتباهًا').length
  const averageProgress = filteredTasks.length
    ? Math.round(filteredTasks.reduce((sum, task) => sum + task.progress, 0) / filteredTasks.length)
    : 0

  return (
    <div className="app-shell" dir="rtl">
      <div className="demo-banner"><Sparkles size={14} /> نسخة تجريبية ببيانات افتراضية — لا تمثل تقييمًا فعليًا لأي قسم</div>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="بوابة أعمال اللجان">
          <div className="brand-mark"><BookOpenCheck size={23} /></div>
          <div><span>كلية الشريعة والأنظمة</span><strong>بوابة أعمال اللجان</strong></div>
        </a>
        <nav className={mobileMenu ? 'topnav is-open' : 'topnav'} aria-label="التنقل الرئيسي">
          <a href="#overview" onClick={() => setMobileMenu(false)}>الرئيسية</a>
          <a href="#weekly" onClick={() => setMobileMenu(false)}>الخطة الأسبوعية</a>
          <a href="#tasks" onClick={() => setMobileMenu(false)}>المهام</a>
          <a href="#templates" onClick={() => setMobileMenu(false)}>القوالب</a>
          <a href="#departments" onClick={() => setMobileMenu(false)}>الأقسام</a>
        </nav>
        <div className="topbar-actions">
          <button className="notification-button" type="button" aria-label="التنبيهات"><BellRing size={19} /><span>2</span></button>
          <a className="sharepoint-button" href={sharePointUrl} target="_blank" rel="noreferrer">مساحة التسليم <ArrowUpLeft size={16} /></a>
          <button className="menu-button" type="button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="فتح القائمة"><Menu size={22} /></button>
        </div>
      </header>

      <main id="top">
        <section className="hero" id="overview">
          <div className="hero-content">
            <span className="eyebrow"><CalendarDays size={16} /> الأسبوع الرابع · مرحلة المتابعة</span>
            <h1>أعمال اللجان،<br /><em>برؤية أوضح.</em></h1>
            <p>كل ما يحتاجه العضو لإنجاز المهمة بصورة صحيحة: موعد واضح، خطوات عملية، قالب موحد، ومعايير جودة قبل الإرسال النهائي.</p>
            <div className="hero-actions">
              <a className="primary-button" href="#tasks">استعرض مهام هذا الأسبوع <ArrowLeft size={18} /></a>
              <a className="secondary-button" href="#templates"><Download size={17} /> تصفح القوالب</a>
            </div>
            <div className="hero-note"><Clock3 size={17} /><span>التسليم المبكر يمنح إشادة أعلى، وتبقى المهلة مفتوحة أسبوعًا بعد الموعد الأساسي.</span></div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-head">
              <div><span>التقدم العام</span><strong>الأسبوع الرابع</strong></div>
              <span className="live-pill"><i /> محدث الآن</span>
            </div>
            <div className="hero-progress">
              <ProgressRing value={64} />
              <div className="progress-breakdown">
                <div><span><i className="dot green" /> مكتمل</span><strong>9</strong></div>
                <div><span><i className="dot gold" /> قيد التنفيذ</span><strong>3</strong></div>
                <div><span><i className="dot red" /> يحتاج انتباهًا</span><strong>2</strong></div>
              </div>
            </div>
            <div className="hero-quality">
              <div className="quality-icon"><Award size={20} /></div>
              <div><span>متوسط جودة الملفات المعتمدة</span><strong>91%</strong></div>
              <span className="quality-trend"><TrendingUp size={15} /> +6%</span>
            </div>
          </div>
        </section>

        <section className="metrics-grid" aria-label="ملخص الأداء">
          <article className="metric-card"><div className="metric-icon mint"><ListChecks size={21} /></div><div><span>مهام الأسبوع</span><strong>14</strong><small>في الأقسام الأربعة</small></div></article>
          <article className="metric-card"><div className="metric-icon blue"><CheckCircle2 size={21} /></div><div><span>أُنجز في الموعد</span><strong>9</strong><small className="positive">64% من المستهدف</small></div></article>
          <article className="metric-card"><div className="metric-icon amber"><Clock3 size={21} /></div><div><span>قيد التنفيذ</span><strong>3</strong><small>ضمن المهلة الأساسية</small></div></article>
          <article className="metric-card"><div className="metric-icon rose"><CircleAlert size={21} /></div><div><span>تحتاج متابعة</span><strong>2</strong><small className="attention-text">تتطلب إجراءً اليوم</small></div></article>
        </section>

        <section className="content-section" id="weekly">
          <div className="section-heading">
            <div><span className="section-kicker">خارطة الفصل</span><h2>التقدم الأسبوعي</h2><p>صورة سريعة لمسار العمل من التهيئة حتى الاعتماد النهائي.</p></div>
            <div className="week-legend"><span><i className="done" /> مكتمل</span><span><i className="now" /> الأسبوع الحالي</span><span><i className="later" /> قادم</span></div>
          </div>
          <div className="week-track">
            {weeklyProgress.map((item) => (
              <button
                type="button"
                className={`week-item ${item.week < currentWeek ? 'is-done' : ''} ${item.week === week ? 'is-active' : ''} ${item.week > currentWeek ? 'is-future' : ''}`}
                key={item.week}
                onClick={() => setWeek(item.week)}
                aria-pressed={item.week === week}
              >
                <div className="week-top"><span>الأسبوع {item.week}</span><strong>{item.progress}%</strong></div>
                <div className="week-bar"><i style={{ width: `${item.progress}%` }} /></div>
                <strong className="week-label">{item.label}</strong>
                <small>{item.completed} من {item.total} مهام</small>
              </button>
            ))}
          </div>
        </section>

        <section className="content-section tasks-section" id="tasks">
          <div className="section-heading tasks-heading">
            <div><span className="section-kicker">دليل التنفيذ</span><h2>مهام الأسبوع {week}</h2><p>افتح أي مهمة لمعرفة الهدف، خطوات الإنجاز، وقائمة فحص الجودة.</p></div>
            <div className="task-tools">
              <label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في المهام" /></label>
              <label className="select-box"><UsersRound size={18} /><select value={department} onChange={(event) => setDepartment(event.target.value as Department)}>{departments.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={16} /></label>
            </div>
          </div>

          <div className="task-summary">
            <span><strong>{filteredTasks.length}</strong> مهمة ظاهرة</span>
            <span><i className="dot green" /><strong>{completed}</strong> مكتملة</span>
            <span><i className="dot gold" /><strong>{active}</strong> قيد التنفيذ</span>
            <span><i className="dot red" /><strong>{attention}</strong> تحتاج متابعة</span>
            <span className="summary-progress"><Gauge size={16} /> متوسط الإنجاز <strong>{averageProgress}%</strong></span>
          </div>

          <div className="tasks-list">
            {filteredTasks.map((task) => (
              <article className="task-row" key={task.id}>
                <div className="task-primary">
                  <div className={`task-state ${statusClass[task.status]}`}>{task.status === 'مكتمل' ? <CheckCircle2 size={20} /> : task.status === 'يحتاج انتباهًا' ? <CircleAlert size={20} /> : <Clock3 size={20} />}</div>
                  <div><span className="task-code">{task.id}</span><h3>{task.title}</h3><p>{task.committee} · {task.department}</p></div>
                </div>
                <div className="task-deliverable"><span>المخرج المطلوب</span><strong>{task.deliverable}</strong></div>
                <div className="task-due"><span>موعد التسليم</span><strong>{task.due}</strong><small>{task.status === 'يحتاج انتباهًا' ? 'متابعة مطلوبة' : 'مهلة إضافية: 7 أيام'}</small></div>
                <div className="task-progress-cell"><div><span>الإنجاز</span><strong>{task.progress}%</strong></div><div className="mini-progress"><i style={{ width: `${task.progress}%` }} /></div>{task.quality && <small>الجودة: {task.quality}%</small>}</div>
                <button className="details-button" type="button" onClick={() => setSelectedTask(task)}>التفاصيل <ChevronLeft size={17} /></button>
              </article>
            ))}
            {!filteredTasks.length && <div className="empty-state"><Search size={30} /><h3>لا توجد مهام مطابقة</h3><p>جرّب اختيار أسبوع أو قسم آخر.</p></div>}
          </div>
        </section>

        <section className="content-section department-section" id="departments">
          <div className="section-heading">
            <div><span className="section-kicker">نظرة إشرافية</span><h2>تقدم الأقسام</h2><p>مؤشر تجريبي يجمع الالتزام بالموعد واكتمال المخرجات وجودتها.</p></div>
            <a className="text-button" href={powerBiUrl} target="_blank" rel="noreferrer">عرض التقرير التفصيلي <ArrowUpLeft size={17} /></a>
          </div>
          <div className="department-grid">
            {departmentMeta.map((item, index) => (
              <article className="department-card" key={item.name} style={{ '--department-accent': item.accent } as React.CSSProperties}>
                <div className="department-head"><div className="department-number">0{index + 1}</div><span className="department-score">{item.progress}%</span></div>
                <h3>{item.name}</h3>
                <div className="department-people"><span>المنسق <strong>{item.coordinator}</strong></span><span>رئيس القسم <strong>{item.head}</strong></span></div>
                <div className="department-progress"><i style={{ width: `${item.progress}%` }} /></div>
                <div className="department-foot"><span>{Math.round(item.progress / 8)} مهام مكتملة</span><button type="button" onClick={() => { setDepartment(item.name as Department); document.querySelector('#tasks')?.scrollIntoView({ behavior: 'smooth' }) }}>عرض المهام <ChevronLeft size={15} /></button></div>
              </article>
            ))}
          </div>
        </section>

        <section className="content-section templates-section" id="templates">
          <div className="templates-intro">
            <span className="section-kicker section-kicker-light">مكتبة العمل</span>
            <h2>ابدأ من قالبٍ صحيح.</h2>
            <p>قوالب موحدة تختصر وقت الإعداد، وتضمن اكتمال العناصر المطلوبة قبل رفع النسخة النهائية إلى SharePoint.</p>
            <a className="light-button" href={sharePointUrl} target="_blank" rel="noreferrer">فتح مكتبة القوالب <ArrowUpLeft size={17} /></a>
          </div>
          <div className="templates-grid">
            {templates.slice(0, 4).map((template) => (
              <article className="template-card" key={template.name}>
                <div className={`file-icon ${template.type.toLowerCase()}`}><FileText size={22} /></div>
                <div className="template-copy"><span>{template.category} · إصدار {template.version}</span><h3>{template.name}</h3><small>{template.type} · استُخدم {template.uses} مرة</small></div>
                <a href={sharePointUrl} target="_blank" rel="noreferrer" aria-label={`فتح ${template.name}`}><ArrowUpLeft size={18} /></a>
              </article>
            ))}
          </div>
        </section>

        <section className="workflow-section">
          <div className="workflow-heading"><span className="section-kicker">مسار العمل</span><h2>من التكليف إلى الاعتماد</h2><p>الموقع يشرح ويوجّه، وSharePoint يحتفظ بالملف النهائي ودليل الإنجاز.</p></div>
          <div className="workflow-steps">
            <div><span>01</span><div className="workflow-icon"><LayoutDashboard size={21} /></div><h3>افهم المهمة</h3><p>راجع الهدف والمخرج والموعد.</p></div>
            <i />
            <div><span>02</span><div className="workflow-icon"><FileCheck2 size={21} /></div><h3>استخدم القالب</h3><p>أنجز وفق الخطوات والمعايير.</p></div>
            <i />
            <div><span>03</span><div className="workflow-icon"><ClipboardCheck size={21} /></div><h3>افحص الجودة</h3><p>تحقق من الاكتمال والدقة.</p></div>
            <i />
            <div><span>04</span><div className="workflow-icon"><FolderOpen size={21} /></div><h3>سلّم نهائيًا</h3><p>ارفع الملف في مجلد SharePoint.</p></div>
          </div>
        </section>
      </main>

      <footer>
        <div className="brand footer-brand"><div className="brand-mark"><BookOpenCheck size={22} /></div><div><span>كلية الشريعة والأنظمة</span><strong>بوابة أعمال اللجان</strong></div></div>
        <p>واجهة إرشادية تجريبية · تبقى النسخ المعتمدة وعمليات التسليم داخل SharePoint</p>
        <a href={sharePointUrl} target="_blank" rel="noreferrer">الدخول إلى SharePoint <ExternalLink size={15} /></a>
      </footer>

      {selectedTask && <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('committee-portal-access') === 'granted')
  return unlocked ? <Dashboard /> : <AccessGate onUnlock={() => setUnlocked(true)} />
}
