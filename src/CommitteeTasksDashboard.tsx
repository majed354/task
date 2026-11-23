import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpLeft, BookOpenCheck, CheckCircle2, Clock3, Copy, FolderOpen, LayoutDashboard, LogOut, RefreshCw, Search } from 'lucide-react'
import { CommitteeAccessError, committeeDepartments, committeeTerms, loadCommitteeTasks, tasksForView, taskState, termDigits, type CommitteeTask, type TaskView } from './committeeTaskData'
import { riyadhDate } from './committeeMetrics'
import type { CourseAccessScope } from './courseReportData'
import { matchesArabicSearch } from './arabicSearch'
import CommitteeNews from './CommitteeNewsPanel'
import type { CommitteeNewsItem } from './committeeNews'

const number = new Intl.NumberFormat('ar-SA-u-nu-latn')
const listUrl = 'https://taifedusa.sharepoint.com/sites/msteams_3b4354/Lists/1448/AllItems.aspx'
const stateLabels = { completed: 'مكتمل', delayed: 'متعثر أو متأخر', upcoming: 'قادمة', active: 'قيد التنفيذ', pending: 'لم يبدأ' }
const views: Array<[TaskView, string]> = [['actionable', 'تحتاج الاستكمال'], ['upcoming', 'المهام القادمة'], ['completed', 'المهام المنجزة'], ['all', 'جميع المهام']]
const dateLabel = (date: string) => date ? `${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)}` : 'غير محدد'

export default function CommitteeTasksDashboard() {
  const [scope, setScope] = useState<CourseAccessScope | null>(null)
  const [records, setRecords] = useState<CommitteeTask[]>([])
  const [news, setNews] = useState<CommitteeNewsItem[]>([])
  const [newsUnavailable, setNewsUnavailable] = useState(false)
  const [submitting, setSubmitting] = useState('')
  const [submissionMessage, setSubmissionMessage] = useState<{ key: string; text: string; error: boolean } | null>(null)
  const [checkedAt, setCheckedAt] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const initial = useMemo(() => new URLSearchParams(window.location.search), [])
  const [term, setTerm] = useState(committeeTerms.some((value) => value === initial.get('term')) ? initial.get('term')! : '481')
  const [department, setDepartment] = useState(initial.get('department') || 'كل الأقسام')
  const [committee, setCommittee] = useState(initial.get('committee') || 'كل اللجان')
  const [query, setQuery] = useState(initial.get('task') || '')
  const [view, setView] = useState<TaskView>(initial.get('task') ? 'all' : 'actionable')
  const [visible, setVisible] = useState(30)
  const [copied, setCopied] = useState('')
  const [today, setToday] = useState(riyadhDate)

  const refresh = useCallback(async () => {
    setBusy(true); setError('')
    try {
      const snapshot = await loadCommitteeTasks()
      setScope(snapshot.scope); setRecords(snapshot.records); setCheckedAt(snapshot.checkedAt)
      setNews(snapshot.news || []); setNewsUnavailable(Boolean(snapshot.newsUnavailable))
      if (snapshot.scope !== 'all') setDepartment(snapshot.scope)
    } catch (cause) {
      if (cause instanceof CommitteeAccessError && cause.status === 401) { setScope(null); setRecords([]); setNews([]); setCheckedAt('') }
      else setError(cause instanceof Error ? cause.message : 'تعذّر تحميل مهام اللجان.')
    } finally { setBusy(false) }
  }, [])
  useEffect(() => {
    document.title = 'لوحة متابعة اللجان — كلية الشريعة والأنظمة'; void refresh()
    const timer = window.setInterval(() => setToday(riyadhDate()), 60_000)
    return () => window.clearInterval(timer)
  }, [refresh])
  useEffect(() => {
    if (!scope) return
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 60_000)
    return () => window.clearInterval(timer)
  }, [scope, refresh])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setLoginError('')
    try {
      const response = await fetch('/api/course/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      if (!response.ok) throw new Error(response.status === 401 ? 'كلمة المرور غير صحيحة.' : response.status === 429 ? 'محاولات كثيرة. حاول بعد عشر دقائق.' : 'تعذّر تسجيل الدخول الآن.')
      setPassword(''); setRecords([]); setView(initial.get('task') ? 'all' : 'actionable'); setQuery(initial.get('task') || ''); await refresh()
    } catch (cause) { setLoginError(cause instanceof Error ? cause.message : 'تعذّر تسجيل الدخول الآن.') }
    finally { setBusy(false) }
  }
  const logout = async () => {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/course/logout', { method: 'POST', credentials: 'same-origin' })
      if (!response.ok) throw new Error('تعذّر تسجيل الخروج. حاول مرة أخرى.')
      setScope(null); setRecords([]); setNews([]); setCheckedAt(''); setDepartment('كل الأقسام'); setCommittee('كل اللجان'); setPassword(''); setQuery('')
    } catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }
  const submitForReview = async (task: CommitteeTask) => {
    const key = `${task.term}:${task.id}`
    setSubmitting(key); setSubmissionMessage(null)
    try {
      const response = await fetch('/api/course/committee-submit', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: task.id, term: task.term }) })
      if (!response.ok) throw new Error(response.status === 401 ? 'انتهت جلسة الدخول. أعد تسجيل الدخول.' : 'تعذّر تسجيل طلب المراجعة. حاول مجددًا.')
      setSubmissionMessage({ key, text: 'سُجّل طلب المراجعة. تُفحص المستندات الجديدة أو المعدّلة في الدورة الدورية كل ثلاثة أيام؛ الاعتماد النهائي مستقل عن المراجعة.', error: false })
      await refresh()
    } catch (cause) { setSubmissionMessage({ key, text: (cause as Error).message, error: true }) }
    finally { setSubmitting('') }
  }
  const allowedDepartment = scope === 'all' ? committeeDepartments.includes(department as typeof committeeDepartments[number]) ? department : 'كل الأقسام' : scope
  const termRecords = useMemo(() => records.filter((task) => task.term === term && (allowedDepartment === 'كل الأقسام' || task.department === allowedDepartment)), [records, term, allowedDepartment])
  const committees = useMemo(() => [...new Set(termRecords.map((task) => task.committee))].sort((a, b) => a.localeCompare(b, 'ar')), [termRecords])
  const selectedCommittee = committees.includes(committee) ? committee : 'كل اللجان'
  const currentRecords = useMemo(() => termRecords.filter((task) => selectedCommittee === 'كل اللجان' || task.committee === selectedCommittee), [termRecords, selectedCommittee])
  const shown = useMemo(() => tasksForView(currentRecords, view, today).filter((task) => matchesArabicSearch(`${task.title} ${task.committee} ${task.id} ${task.deliverable}`, query)), [currentRecords, view, today, query])
  const complete = currentRecords.filter((task) => taskState(task, today) === 'completed').length
  const delayed = currentRecords.filter((task) => taskState(task, today) === 'delayed').length
  const actionable = tasksForView(currentRecords, 'actionable', today).length
  const upcoming = tasksForView(currentRecords, 'upcoming', today).length
  const updatedLabel = checkedAt ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(checkedAt)) : ''
  const stale = checkedAt && Date.now() - Date.parse(checkedAt) > 3 * 60 * 60 * 1000
  const shareLink = async () => {
    const url = new URL(window.location.origin + '/')
    url.searchParams.set('view', 'dashboard'); url.searchParams.set('term', term)
    if (allowedDepartment && allowedDepartment !== 'كل الأقسام') url.searchParams.set('department', allowedDepartment)
    if (selectedCommittee !== 'كل اللجان') url.searchParams.set('committee', selectedCommittee)
    try { await navigator.clipboard.writeText(url.href); setCopied('تم نسخ رابط هذا العرض') }
    catch { setCopied(`رابط هذا العرض: ${url.href}`) }
  }
  useEffect(() => { setVisible(30); setCopied('') }, [term, department, committee, query, view])

  return <div className="app-shell monitoring-shell" dir="rtl">
    <header className="topbar"><a className="brand" href="/" aria-label="دليل أعمال اللجان"><span className="brand-mark"><BookOpenCheck size={23} /></span><span><small>كلية الشريعة والأنظمة</small><strong>أعمال اللجان</strong></span></a><nav className="topnav monitor-topnav" aria-label="أقسام الموقع"><a className="portal-tab" href="/">دليل أعمال اللجان</a><a className="portal-tab is-current" href="/?view=dashboard" aria-current="page">لوحة متابعة اللجان</a><a className="portal-tab" href="/?view=course-reports">تقارير المقررات</a></nav></header>
    <main className="monitor-main">
      <section className="monitor-hero"><div><span className="monitor-eyebrow"><LayoutDashboard size={17} /> متابعة أعمال اللجان</span><h1>لوحة متابعة اللجان</h1><p>مهام قسمك ومواعيدها، مع وصول مباشر إلى مجلد كل مهمة لاستكمال مستنداتها.</p></div><div className="monitor-hero-badge"><span>الفصل الحالي</span><strong>٤٨١</strong><small>رمز الدخول نفسه لتقارير المقررات</small></div></section>
      {!scope && <section className="course-access-panel" aria-label="الدخول إلى مهام القسم"><h2>الدخول إلى متابعة اللجان</h2><p>أدخل كلمة مرور قسمك المستخدمة في تقارير المقررات. تظهر لك مهام قسمك فقط، ورمز العرض الكلي يتيح متابعة الأقسام الأربعة.</p><form onSubmit={(event) => void login(event)}><label htmlFor="committee-password">كلمة المرور<input id="committee-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required disabled={busy} /></label><button type="submit" disabled={busy}>{busy ? 'جارٍ التحميل…' : 'دخول'}</button></form>{loginError && <p className="monitor-error" role="alert">{loginError}</p>}</section>}
      {error && <p className="monitor-error" role="alert">{error}</p>}
      {scope && <>
        <div className="monitor-toolbar"><span className="monitor-account">{scope === 'all' ? 'العرض الكلي' : scope} · آخر مزامنة: {updatedLabel}</span><div className="committee-toolbar-actions"><button type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> {busy ? 'جارٍ التحديث' : 'تحديث البيانات'}</button><button type="button" onClick={() => void logout()} disabled={busy}><LogOut size={16} /> خروج</button></div></div>
        {stale && <p className="monitor-error" role="alert">آخر مزامنة أقدم من ثلاث ساعات. راجع سجل اللجان للتحقق من آخر حالة.</p>}
        <section className="monitor-control-panel" aria-label="تصفية مهام اللجان"><div className="monitor-panel-head"><h2>نطاق العرض</h2><button type="button" className="committee-share" onClick={() => void shareLink()}><Copy size={16} /> نسخ رابط اللجنة</button></div><div className="monitor-filters">
          <label>الفصل<select value={term} onChange={(event) => { setTerm(event.target.value); setCommittee('كل اللجان') }}>{committeeTerms.map((code) => <option key={code} value={code}>الفصل {termDigits(code)}</option>)}</select></label>
          <label>القسم<select value={allowedDepartment || 'كل الأقسام'} disabled={scope !== 'all'} onChange={(event) => { setDepartment(event.target.value); setCommittee('كل اللجان') }}>{scope === 'all' ? <><option>كل الأقسام</option>{committeeDepartments.map((name) => <option key={name}>{name}</option>)}</> : <option>{scope}</option>}</select></label>
          <label>اللجنة<select value={selectedCommittee} onChange={(event) => setCommittee(event.target.value)}><option>كل اللجان</option>{committees.map((name) => <option key={name}>{name}</option>)}</select></label>
        </div>{copied && <p className="monitor-note" role="status">{copied}</p>}<p className="monitor-note">رابط اللجنة يحفظ اختيار الفصل والقسم واللجنة، ويظل الدخول بكلمة المرور مطلوبًا.</p></section>
        <section className="monitor-kpis is-aggregate" aria-label="مؤشرات مهام النطاق"><article><span><FolderOpen size={18} /> إجمالي المهام</span><strong>{number.format(currentRecords.length)}</strong><small>الفصل {termDigits(term)}</small></article><article><span><CheckCircle2 size={18} /> مكتمل</span><strong>{number.format(complete)}</strong><small>{currentRecords.length ? Math.round(complete * 100 / currentRecords.length) : 0}٪ من المهام</small></article><article><span><Clock3 size={18} /> تحتاج الاستكمال الآن</span><strong>{number.format(actionable)}</strong><small>{number.format(upcoming)} مهمة قادمة</small></article><article className="is-alert"><span><AlertTriangle size={18} /> متعثر أو متأخر</span><strong>{number.format(delayed)}</strong><small>بحسب الموعد وحالة السجل</small></article></section>
        <CommitteeNews news={news} records={currentRecords} unavailable={newsUnavailable} />
        <section className="monitor-panel committee-task-panel" aria-label="مهام اللجان"><div className="monitor-panel-head"><h2>مهام اللجنة</h2><span>{number.format(shown.length)} مهمة في هذا العرض</span></div><div className="committee-task-controls"><div className="committee-view-tabs" role="group" aria-label="حالة المهام">{views.map(([value, label]) => <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{label} <span>{number.format(tasksForView(currentRecords, value, today).length)}</span></button>)}</div><label className="committee-task-search"><Search size={17} /><input aria-label="بحث في المهام" placeholder="ابحث عن مهمة أو مخرج مطلوب" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
          <div className="committee-task-list">{shown.slice(0, visible).map((task) => {
            const state = taskState(task, today)
            return <article className={`committee-task-card is-${state}`} key={`${task.term}:${task.id}`}><div className="committee-task-heading"><div><small>{task.department} · {task.committee}</small><h3>{task.title}</h3></div><span className={`committee-task-status is-${state}`}>{stateLabels[state]}</span></div><div className="committee-task-dates"><span>بداية التنفيذ: <strong>{dateLabel(task.start)}</strong></span><span>التسليم: <strong>{dateLabel(task.due)}</strong></span><span>{task.period}</span></div>{task.deliverable && <p><strong>المطلوب:</strong> {task.deliverable}</p>}{task.evidence && <p className="committee-task-evidence"><strong>الشاهد:</strong> {task.evidence}</p>}<div className="committee-task-actions"><a className="committee-folder-button" href={task.folderUrl} target="_blank" rel="noreferrer" aria-label={`فتح مجلد المهمة: ${task.title}`}><FolderOpen size={18} /> {state === 'completed' ? 'فتح مجلد المهمة' : 'فتح مجلد المهمة ورفع المستندات'}<ArrowUpLeft size={16} /></a><button type="button" className="committee-review-button" disabled={Boolean(submitting)} onClick={() => void submitForReview(task)}>{submitting === `${task.term}:${task.id}` ? 'جارٍ تسجيل الطلب…' : 'طلب مراجعة المستندات بعد رفعها'}</button><small>حالة السجل: {task.status}</small></div>{submissionMessage?.key === `${task.term}:${task.id}` && <p className={submissionMessage.error ? 'monitor-error' : 'monitor-note'} role={submissionMessage.error ? 'alert' : 'status'}>{submissionMessage.text}</p>}</article>
          })}</div>
          {!shown.length && <p className="committee-empty" role="status">{currentRecords.length ? 'لا توجد مهام تطابق هذا العرض.' : 'لا توجد مهام مسجلة لهذا الفصل في نطاقك.'}</p>}
          {visible < shown.length && <button type="button" className="course-more" onClick={() => setVisible((value) => value + 30)}>عرض المزيد ({number.format(shown.length - visible)})</button>}
        </section><p className="monitor-note">يفتح الزر مجلد المهمة في التيم؛ اختر «تحميل» لرفع مستنداتها بحساب الجامعة. حالة الإنجاز مأخوذة من سجل اللجان، ورفع ملف وحده لا يغيرها تلقائيًا.</p>
        <div className="monitor-source-line"><a href={listUrl} target="_blank" rel="noreferrer">فتح سجل اللجان لتحديث الحالة</a> · <a href="/?view=committee-metrics">المؤشرات العامة للجان</a></div>
      </>}
    </main><footer className="site-footer"><strong>متابعة الجودة</strong><span>كلية الشريعة والأنظمة</span></footer>
  </div>
}
