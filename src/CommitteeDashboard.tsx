import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpLeft, BookOpenCheck, CheckCircle2, Clock3, FolderOpen, LayoutDashboard, LogIn, LogOut, RefreshCw } from 'lucide-react'
import { counts, isDelayed, riyadhDate } from './committeeMetrics'
import { connectedAccount, connectSharePoint, disconnectSharePoint, loadCommitteeSnapshot, sharePointReady, type CommitteeSnapshot } from './sharePointData'

const sitePage = 'https://taifedusa.sharepoint.com/sites/msteams_3b4354/Lists/1448/AllItems.aspx'
const guideFolder = `https://taifedusa.sharepoint.com/sites/msteams_3b4354/Shared%20Documents/Forms/AllItems.aspx?id=${encodeURIComponent('/sites/msteams_3b4354/Shared Documents/أعمال اللجان/دليل مهام اللجان/٤٨١')}`
const number = new Intl.NumberFormat('ar-SA-u-nu-latn')

function safeFolder(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:'
      && parsed.hostname === 'taifedusa.sharepoint.com'
      && parsed.pathname.startsWith('/sites/msteams_3b4354/')
  } catch { return false }
}

function dateLabel(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—'
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`
}

export default function CommitteeDashboard() {
  const [account, setAccount] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<CommitteeSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [department, setDepartment] = useState('الكل')
  const [committee, setCommittee] = useState('الكل')
  const today = riyadhDate()

  const refresh = useCallback(async () => {
    setBusy(true)
    setError('')
    try { setSnapshot(await loadCommitteeSnapshot()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر تحميل بيانات المتابعة.') }
    finally { setBusy(false) }
  }, [])

  useEffect(() => {
    document.title = 'لوحة متابعة اللجان — كلية الشريعة والأنظمة'
    if (!sharePointReady) return
    let active = true
    connectedAccount().then((user) => {
      if (!active) return
      setAccount(user)
      if (user) void refresh()
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'تعذّر تهيئة تسجيل الدخول.')
    })
    return () => { active = false }
  }, [refresh])

  const records = snapshot?.records ?? []
  const departments = useMemo(() => Array.from(new Set(records.map((record) => record.department).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar')), [records])
  const committees = useMemo(() => Array.from(new Set(records.filter((record) => department === 'الكل' || record.department === department).map((record) => record.committee).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar')), [records, department])
  const visible = useMemo(() => records.filter((record) => (department === 'الكل' || record.department === department) && (committee === 'الكل' || record.committee === committee)), [records, department, committee])
  const summary = useMemo(() => counts(visible, today), [visible, today])
  const departmentRows = useMemo(() => departments.map((name) => ({ name, ...counts(records.filter((record) => record.department === name), today) })), [departments, records, today])
  const delayedTasks = useMemo(() => visible.filter((record) => isDelayed(record, today)).sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title, 'ar')).slice(0, 25), [visible, today])
  const progress = summary.total ? Math.round(summary.completed * 100 / summary.total) : 0

  async function signIn() {
    setError('')
    try { await connectSharePoint() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر بدء تسجيل الدخول.') }
  }

  async function signOut() {
    setError('')
    try { await disconnectSharePoint() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر تسجيل الخروج.') }
  }

  return <div className="app-shell monitoring-shell" dir="rtl">
    <header className="topbar" id="top">
      <a className="brand" href="/" aria-label="دليل أعمال اللجان"><span className="brand-mark"><BookOpenCheck size={23} /></span><span><small>كلية الشريعة والأنظمة</small><strong>أعمال اللجان</strong></span></a>
      <nav className="topnav monitor-topnav" aria-label="قسما الموقع">
        <a className="portal-tab" href="/">دليل أعمال اللجان</a>
        <a className="portal-tab is-current" href="/?view=dashboard" aria-current="page">لوحة المتابعة</a>
      </nav>
      <a className="monitor-header-link" href={guideFolder} target="_blank" rel="noreferrer">مجلد اللجان <ArrowUpLeft size={15} /></a>
    </header>

    <main className="monitor-main">
      <div className="monitor-intro">
        <span className="monitor-eyebrow"><LayoutDashboard size={17} /> المتابعة التشغيلية</span>
        <h1>لوحة متابعة اللجان</h1>
        <p>تُقرأ الحالات والمواعيد من سجل مهام اللجان، ويُفحص وجود عناصر مضافة في مجلد كل مهمة داخل SharePoint.</p>
      </div>

      {!sharePointReady ? <section className="monitor-gate" aria-live="polite">
        <h2>الربط بحساب الجامعة لم يُفعّل بعد</h2>
        <p>يحتاج هذا القسم إلى تسجيل تطبيق Microsoft 365 للقراءة فقط. بيانات اللجان لا تُنشر على Netlify؛ تظهر بعد دخول العضو المصرح له إلى SharePoint.</p>
        <a href={sitePage} target="_blank" rel="noreferrer">فتح لوحة SharePoint الحالية <ArrowUpLeft size={16} /></a>
      </section> : !account ? <section className="monitor-gate" aria-live="polite">
        <h2>الدخول بحساب الجامعة</h2>
        <p>يعرض هذا القسم بيانات موقع قادة الكلية للأعضاء الذين يملكون صلاحية الوصول إليه.</p>
        <button className="monitor-primary" type="button" onClick={() => void signIn()}><LogIn size={18} /> اتصال بـ Microsoft 365</button>
        {error && <p className="monitor-error" role="alert">{error}</p>}
      </section> : <>
        <div className="monitor-toolbar">
          <span className="monitor-account">متصل: {account}</span>
          <div><button type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> {busy ? 'جارٍ التحديث' : 'تحديث البيانات'}</button><button type="button" onClick={() => void signOut()}><LogOut size={16} /> خروج</button></div>
        </div>
        {error && <p className="monitor-error" role="alert">{error}</p>}
        {!snapshot && busy ? <div className="monitor-gate">جارٍ قراءة سجل المهام ومجلداتها…</div> : snapshot && <>
          <div className="monitor-source-line">آخر قراءة: {new Intl.DateTimeFormat('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(snapshot.fetchedAt)} · التاريخ المرجعي للتعثر: {dateLabel(today)} · <a href={sitePage} target="_blank" rel="noreferrer">سجل SharePoint</a></div>
          <div className="monitor-filters">
            <label>القسم<select value={department} onChange={(event) => { setDepartment(event.target.value); setCommittee('الكل') }}><option value="الكل">كل الأقسام</option>{departments.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label>اللجنة<select value={committee} onChange={(event) => setCommittee(event.target.value)}><option value="الكل">كل اللجان</option>{committees.map((name) => <option key={name}>{name}</option>)}</select></label>
          </div>
          <section className="monitor-kpis" aria-label="المؤشرات الرئيسية">
            <article><span><FolderOpen size={18} /> إجمالي المهام</span><strong>{number.format(summary.total)}</strong></article>
            <article><span><CheckCircle2 size={18} /> مكتمل</span><strong>{number.format(summary.completed)}</strong><small>{progress}% من المهام</small></article>
            <article><span><Clock3 size={18} /> قيد التنفيذ</span><strong>{number.format(summary.inProgress)}</strong></article>
            <article className="is-alert"><span><AlertTriangle size={18} /> متعثر أو متأخر</span><strong>{number.format(summary.delayed)}</strong><small>تجاوز الموعد دون إنجاز، أو سُجّل متعثرًا</small></article>
            <article><span><FolderOpen size={18} /> مجلدات بها عناصر إضافية</span><strong>{summary.withAdditionalFiles === null ? '—' : number.format(summary.withAdditionalFiles)}</strong><small>وجود ملف لا يعني اعتماد الإنجاز</small></article>
          </section>
          <section className="monitor-panel">
            <div className="monitor-panel-head"><h2>توزيع حالات المهام</h2><span>{number.format(summary.total)} مهمة في النطاق</span></div>
            <div className="monitor-distribution" role="img" aria-label={`مكتمل ${summary.completed}، قيد التنفيذ ${summary.inProgress}، متأخر ${summary.delayed}، لم يبدأ ${summary.pending}`}>
              {([['مكتمل', summary.completed, 'complete'], ['قيد التنفيذ', summary.inProgress, 'active'], ['متعثر أو متأخر', summary.delayed, 'delayed'], ['لم يبدأ', summary.pending, 'pending']] as const).map(([label, count, type]) => <div key={type} className={`monitor-bar-row is-${type}`}><span>{label}</span><div><i style={{ width: `${summary.total ? Math.max(0, count * 100 / summary.total) : 0}%` }} /></div><strong>{number.format(count)}</strong></div>)}
            </div>
          </section>
          <section className="monitor-panel">
            <div className="monitor-panel-head"><h2>الأقسام الأربعة</h2><span>يُحسب كل قسم من سجلاته</span></div>
            <div className="monitor-departments">{departmentRows.map((row) => <article key={row.name}><h3>{row.name}</h3><strong>{number.format(row.completed)} / {number.format(row.total)}</strong><small>مكتمل · {number.format(row.delayed)} متعثر أو متأخر</small></article>)}</div>
          </section>
          <section className="monitor-panel">
            <div className="monitor-panel-head"><h2>المهام التي تحتاج متابعة</h2><span>{number.format(summary.delayed)} متعثرة أو متأخرة</span></div>
            {delayedTasks.length ? <div className="monitor-table-wrap"><table><thead><tr><th>المهمة</th><th>القسم واللجنة</th><th>موعد التسليم</th><th>الحالة</th><th>المجلد</th></tr></thead><tbody>{delayedTasks.map((record) => <tr key={record.id}><td><strong>{record.title}</strong></td><td>{record.department}<small>{record.committee}</small></td><td>{dateLabel(record.due)}</td><td>{record.status}</td><td>{safeFolder(record.folderUrl) ? <a href={record.folderUrl} target="_blank" rel="noreferrer">فتح المجلد <ArrowUpLeft size={14} /></a> : '—'}</td></tr>)}</tbody></table>{summary.delayed > 25 && <p>تظهر أول 25 مهمة بحسب الموعد. يمكن الاطلاع على جميع المهام في سجل SharePoint.</p>}</div> : <p className="monitor-empty">لا توجد مهام متأخرة في النطاق المحدد.</p>}
          </section>
          {!snapshot.foldersChecked && <p className="monitor-note">تعذّر فحص المجلدات في هذه القراءة؛ مؤشرات الحالة والمواعيد مأخوذة من سجل المهام فقط.</p>}
        </>}
      </>}
    </main>
    <footer className="site-footer"><strong>أعمال اللجان</strong><span>كلية الشريعة والأنظمة</span></footer>
  </div>
}
