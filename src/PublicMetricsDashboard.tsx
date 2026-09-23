import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpLeft, BookOpenCheck, CheckCircle2, Clock3, FolderOpen, LayoutDashboard, RefreshCw } from 'lucide-react'
import { loadPublicMetrics, type PublicMetricsRow } from './publicMetricsData'

const sitePage = 'https://taifedusa.sharepoint.com/sites/msteams_3b4354/Lists/1448/AllItems.aspx'
const number = new Intl.NumberFormat('ar-SA-u-nu-latn')

export default function PublicMetricsDashboard() {
  const [rows, setRows] = useState<PublicMetricsRow[]>([])
  const [department, setDepartment] = useState('كل الأقسام')
  const [committee, setCommittee] = useState('كل اللجان')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setBusy(true)
    setError('')
    try { setRows(await loadPublicMetrics()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر تحميل مؤشرات اللجان.') }
    finally { setBusy(false) }
  }, [])

  useEffect(() => {
    document.title = 'لوحة متابعة اللجان — كلية الشريعة والأنظمة'
    void refresh()
  }, [refresh])

  const departments = useMemo(() => rows.filter((row) => row.department !== 'كل الأقسام' && row.committee === 'كل اللجان'), [rows])
  const committees = useMemo(() => rows.filter((row) => row.department === department && row.committee !== 'كل اللجان'), [rows, department])
  const current = rows.find((row) => row.department === department && row.committee === committee)
  const progress = current?.total ? Math.round(current.completed * 100 / current.total) : 0
  const dated = current?.updatedAt?.slice(0, 10)
  const sourceTime = current?.updatedAt ? Date.parse(`${current.updatedAt.slice(0, 19)}+03:00`) : NaN
  const stale = Number.isFinite(sourceTime) && Date.now() - sourceTime > 3 * 60 * 60 * 1000

  return <div className="app-shell monitoring-shell" dir="rtl">
    <header className="topbar" id="top">
      <a className="brand" href="/" aria-label="دليل أعمال اللجان"><span className="brand-mark"><BookOpenCheck size={23} /></span><span><small>كلية الشريعة والأنظمة</small><strong>أعمال اللجان</strong></span></a>
      <nav className="topnav monitor-topnav" aria-label="قسما الموقع">
        <a className="portal-tab" href="/">دليل أعمال اللجان</a>
        <a className="portal-tab is-current" href="/?view=dashboard" aria-current="page">لوحة المتابعة</a>
      </nav>
      <a className="monitor-header-link" href={sitePage} target="_blank" rel="noreferrer">سجل اللجان <ArrowUpLeft size={15} /></a>
    </header>
    <main className="monitor-main">
      <div className="monitor-intro">
        <span className="monitor-eyebrow"><LayoutDashboard size={17} /> المتابعة التشغيلية</span>
        <h1>لوحة متابعة اللجان</h1>
        <p>مؤشرات مجمّعة من سجل مهام اللجان في SharePoint. يُحدّثها التدفق الآلي في Google Sheets، وتُعرض هنا دون نشر أسماء المهام أو ملفاتها.</p>
      </div>
      <div className="monitor-toolbar"><span className="monitor-account">{dated ? `تاريخ بيانات المؤشرات: ${dated}` : 'بانتظار أول قراءة للمؤشرات'}</span><div><button type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> {busy ? 'جارٍ التحديث' : 'تحديث البيانات'}</button></div></div>
      {error && <p className="monitor-error" role="alert">{error}</p>}
      {stale && <p className="monitor-error" role="alert">بيانات المؤشرات أقدم من ثلاث ساعات. راجع سجل SharePoint حتى تعود المزامنة.</p>}
      {!current && !error && <div className="monitor-gate">جارٍ تحميل مؤشرات اللجان…</div>}
      {current && <>
        <div className="monitor-source-line">المصدر: <a href={sitePage} target="_blank" rel="noreferrer">سجل SharePoint</a> · تاريخ آخر مزامنة: {current.updatedAt}</div>
        <div className="monitor-filters">
          <label>القسم<select value={department} onChange={(event) => { setDepartment(event.target.value); setCommittee('كل اللجان') }}><option>كل الأقسام</option>{departments.map((row) => <option key={row.department}>{row.department}</option>)}</select></label>
          <label>اللجنة<select value={committee} onChange={(event) => setCommittee(event.target.value)} disabled={department === 'كل الأقسام'}><option>كل اللجان</option>{committees.map((row) => <option key={row.committee}>{row.committee}</option>)}</select></label>
        </div>
        <section className="monitor-kpis is-aggregate" aria-label="المؤشرات الرئيسية">
          <article><span><FolderOpen size={18} /> إجمالي المهام</span><strong>{number.format(current.total)}</strong></article>
          <article><span><CheckCircle2 size={18} /> مكتمل</span><strong>{number.format(current.completed)}</strong><small>{progress}% من المهام</small></article>
          <article><span><Clock3 size={18} /> قيد التنفيذ</span><strong>{number.format(current.inProgress)}</strong></article>
          <article className="is-alert"><span><AlertTriangle size={18} /> متعثر أو متأخر</span><strong>{number.format(current.delayed)}</strong><small>بحسب الحالة والموعد في السجل</small></article>
        </section>
        <section className="monitor-panel">
          <div className="monitor-panel-head"><h2>توزيع حالات المهام</h2><span>{number.format(current.total)} مهمة في النطاق</span></div>
          <div className="monitor-distribution" role="img" aria-label={`مكتمل ${current.completed}، قيد التنفيذ ${current.inProgress}، متعثر أو متأخر ${current.delayed}، لم يبدأ ${current.pending}`}>
            {([['مكتمل', current.completed, 'complete'], ['قيد التنفيذ', current.inProgress, 'active'], ['متعثر أو متأخر', current.delayed, 'delayed'], ['لم يبدأ', current.pending, 'pending']] as const).map(([label, count, type]) => <div key={type} className={`monitor-bar-row is-${type}`}><span>{label}</span><div><i style={{ width: `${current.total ? count * 100 / current.total : 0}%` }} /></div><strong>{number.format(count)}</strong></div>)}
          </div>
        </section>
        <section className="monitor-panel">
          <div className="monitor-panel-head"><h2>الأقسام الأربعة</h2><span>يُحسب كل قسم من سجلاته</span></div>
          <div className="monitor-departments">{departments.map((row) => <article key={row.department}><h3>{row.department}</h3><strong>{number.format(row.completed)} / {number.format(row.total)}</strong><small>مكتمل · {number.format(row.delayed)} متعثر أو متأخر</small></article>)}</div>
        </section>
        <p className="monitor-note">للاطلاع على تفاصيل المهام المتعثرة وتحديث حالاتها، افتح <a href={sitePage} target="_blank" rel="noreferrer">سجل SharePoint</a> بحساب الجامعة.</p>
      </>}
    </main>
    <footer className="site-footer"><strong>أعمال اللجان</strong><span>كلية الشريعة والأنظمة</span></footer>
  </div>
}
