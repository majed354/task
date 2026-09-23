import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowUpLeft, BookOpenCheck, CheckCircle2, Clock3, FolderOpen, LayoutDashboard, Medal, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
import { currentTermCode, loadPublicMetrics, metricsForTerm, termCodes, type PublicMetricsRow } from './publicMetricsData'

const sitePage = 'https://taifedusa.sharepoint.com/sites/msteams_3b4354/Lists/1448/AllItems.aspx'
const folderPath = '/sites/msteams_3b4354/Shared Documents/أعمال اللجان/دليل مهام اللجان'
const folderUrl = (path: string) => `https://taifedusa.sharepoint.com/sites/msteams_3b4354/Shared%20Documents/Forms/AllItems.aspx?id=${encodeURIComponent(path)}`
const number = new Intl.NumberFormat('ar-SA-u-nu-latn')
const arabicDigits = (value: string) => value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
const termLabel = (term: string) => term === 'all' ? 'جميع الفصول' : `الفصل ${arabicDigits(term)}`
const termFolder = (term: string) => folderUrl(`${folderPath}/${arabicDigits(term)}`)
const points = (row: PublicMetricsRow) => row.completed * 10 + row.inProgress * 3
const score = (row: PublicMetricsRow) => row.total ? Math.round(points(row) * 10 / row.total) : 0

export default function PublicMetricsDashboard() {
  const [rows, setRows] = useState<PublicMetricsRow[]>([])
  const [term, setTerm] = useState(currentTermCode)
  const [department, setDepartment] = useState('كل الأقسام')
  const [committee, setCommittee] = useState('كل اللجان')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    setBusy(true); setError('')
    try { setRows(await loadPublicMetrics()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر تحميل مؤشرات اللجان.') }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { document.title = 'لوحة متابعة اللجان — كلية الشريعة والأنظمة'; void refresh() }, [refresh])

  const scoped = useMemo(() => metricsForTerm(rows, term), [rows, term])
  const departments = scoped.filter((row) => row.department !== 'كل الأقسام' && row.committee === 'كل اللجان')
  const committees = scoped.filter((row) => row.department === department && row.committee !== 'كل اللجان')
  const current = scoped.find((row) => row.department === department && row.committee === committee)
  const overall = scoped.find((row) => row.department === 'كل الأقسام' && row.committee === 'كل اللجان')
  const lastUpdated = rows.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, '')
  const sourceTime = lastUpdated ? Date.parse(`${lastUpdated.slice(0, 19).replace(' ', 'T')}+03:00`) : NaN
  const lastUpdatedLabel = Number.isFinite(sourceTime)
    ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(sourceTime)
    : ''
  const stale = Number.isFinite(sourceTime) && Date.now() - sourceTime > 3 * 60 * 60 * 1000
  const progress = current?.total ? Math.round(current.completed * 100 / current.total) : 0
  const eligible = scoped.filter((row) => row.department !== 'كل الأقسام' && row.committee !== 'كل اللجان' && row.total > 0 && (department === 'كل الأقسام' || row.department === department))
  const leaderboard = [...eligible].filter((row) => points(row) > 0).sort((left, right) => score(right) - score(left) || right.completed - left.completed || left.committee.localeCompare(right.committee, 'ar')).slice(0, 6)

  return <div className="app-shell monitoring-shell" dir="rtl">
    <header className="topbar" id="top"><a className="brand" href="/" aria-label="دليل أعمال اللجان"><span className="brand-mark"><BookOpenCheck size={23} /></span><span><small>كلية الشريعة والأنظمة</small><strong>أعمال اللجان</strong></span></a><nav className="topnav monitor-topnav" aria-label="أقسام الموقع"><a className="portal-tab" href="/">دليل أعمال اللجان</a><a className="portal-tab is-current" href="/?view=dashboard" aria-current="page">لوحة متابعة اللجان</a><a className="portal-tab" href="/?view=course-reports">تقارير المقررات</a></nav><a className="monitor-header-link" href={sitePage} target="_blank" rel="noreferrer">سجل اللجان <ArrowUpLeft size={15} /></a></header>
    <main className="monitor-main">
      <section className="monitor-hero"><div><span className="monitor-eyebrow"><LayoutDashboard size={17} /> المتابعة التشغيلية</span><h1>لوحة متابعة اللجان</h1><p>قراءة لأعمال الأقسام واللجان بحسب الفصل، من مؤشرات مجمّعة في سجل SharePoint. لا تُنشر أسماء المهام أو ملفاتها في اللوحة العامة.</p></div><div className="monitor-hero-badge"><span>الفصل الحالي</span><strong>٤٨١</strong><small>تبدأ منه بيانات المهام</small></div></section>
      <div className="monitor-toolbar"><span className="monitor-account">{lastUpdatedLabel ? `آخر مزامنة: ${lastUpdatedLabel}` : 'بانتظار أول قراءة للمؤشرات'}</span><button type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> {busy ? 'جارٍ التحديث' : 'تحديث البيانات'}</button></div>
      {error && <p className="monitor-error" role="alert">{error}</p>}{stale && <p className="monitor-error" role="alert">بيانات المؤشرات أقدم من ثلاث ساعات. راجع سجل SharePoint حتى تعود المزامنة.</p>}
      <section className="monitor-control-panel" aria-label="تصفية المؤشرات"><div className="monitor-panel-head"><h2>نطاق العرض</h2><span>الافتراضي: الفصل الحالي ٤٨١</span></div><div className="monitor-filters">
        <label>الفصل<select value={term} onChange={(event) => { setTerm(event.target.value); setDepartment('كل الأقسام'); setCommittee('كل اللجان') }}><option value="all">جميع الفصول</option>{termCodes.map((code) => <option value={code} key={code}>{termLabel(code)}</option>)}</select></label>
        <label>القسم<select value={department} onChange={(event) => { setDepartment(event.target.value); setCommittee('كل اللجان') }} disabled={!overall?.total}><option>كل الأقسام</option>{departments.map((row) => <option key={row.department}>{row.department}</option>)}</select></label>
        <label>اللجنة<select value={committee} onChange={(event) => setCommittee(event.target.value)} disabled={department === 'كل الأقسام'}><option>كل اللجان</option>{committees.map((row) => <option key={row.committee}>{row.committee}</option>)}</select></label>
      </div><div className="monitor-source-line">المصدر: <a href={sitePage} target="_blank" rel="noreferrer">سجل SharePoint</a> · <a href={term === 'all' ? folderUrl(folderPath) : termFolder(term)} target="_blank" rel="noreferrer">مجلد {termLabel(term)}</a></div></section>
      {!rows.length && !error && <div className="monitor-gate">جارٍ تحميل مؤشرات اللجان…</div>}
      {rows.length > 0 && !overall?.total && <section className="monitor-empty-term"><FolderOpen size={26} /><h2>لا توجد مهام مسجلة في {termLabel(term)}</h2><p>هيكل الأقسام واللجان جاهز في SharePoint. ستظهر المؤشرات عندما تُضاف سجلات مهام لهذا الفصل وتُزامَن.</p><a href={termFolder(term)} target="_blank" rel="noreferrer">فتح مجلد الفصل <ArrowUpLeft size={15} /></a></section>}
      {current && current.total > 0 && <>
        <section className="monitor-kpis is-aggregate" aria-label="المؤشرات الرئيسية"><article><span><FolderOpen size={18} /> إجمالي المهام</span><strong>{number.format(current.total)}</strong><small>{termLabel(term)}</small></article><article><span><CheckCircle2 size={18} /> مكتمل</span><strong>{number.format(current.completed)}</strong><small>{progress}% من المهام</small></article><article><span><Clock3 size={18} /> قيد التنفيذ</span><strong>{number.format(current.inProgress)}</strong><small>ضمن الموعد</small></article><article className="is-alert"><span><AlertTriangle size={18} /> متعثر أو متأخر</span><strong>{number.format(current.delayed)}</strong><small>بحسب الحالة وموعد التسليم</small></article></section>
        <section className="monitor-story-grid"><div className="monitor-panel"><div className="monitor-panel-head"><h2>توزيع حالات المهام</h2><span>{number.format(current.total)} مهمة في النطاق</span></div><div className="monitor-distribution" role="img" aria-label={`مكتمل ${current.completed}، قيد التنفيذ ${current.inProgress}، متعثر أو متأخر ${current.delayed}، لم يبدأ ${current.pending}`}>{([['مكتمل', current.completed, 'complete'], ['قيد التنفيذ', current.inProgress, 'active'], ['متعثر أو متأخر', current.delayed, 'delayed'], ['لم يبدأ', current.pending, 'pending']] as const).map(([label, count, type]) => <div key={type} className={`monitor-bar-row is-${type}`}><span>{label}</span><div><i style={{ width: `${current.total ? count * 100 / current.total : 0}%` }} /></div><strong>{number.format(count)}</strong></div>)}</div></div><div className="monitor-panel monitor-progress-panel"><div className="monitor-panel-head"><h2>نسبة الإنجاز</h2><TrendingUp size={18} /></div><div className="monitor-progress-ring" style={{ background: `conic-gradient(#168675 ${progress}%, #e8eee9 ${progress}% 100%)` }}><span><strong>{progress}%</strong><small>مكتمل</small></span></div><p>تُحسب من المهام المكتملة فقط؛ المهام قيد التنفيذ ليست إنجازاً نهائياً.</p></div></section>
        {department === 'كل الأقسام' && <section className="monitor-panel"><div className="monitor-panel-head"><h2>الأقسام الأربعة</h2><span>مؤشرات كل قسم من سجلاته</span></div><div className="monitor-departments">{departments.map((row) => <article key={row.department}><h3>{row.department}</h3><strong>{number.format(row.completed)} / {number.format(row.total)}</strong><small>مكتمل · {number.format(row.delayed)} متعثر أو متأخر</small><div className="monitor-mini-track"><i style={{ width: `${row.total ? row.completed * 100 / row.total : 0}%` }} /></div></article>)}</div></section>}
        <section className="monitor-panel monitor-rewards"><div className="monitor-panel-head"><h2><Medal size={20} /> نقاط اللجان التحفيزية</h2><span>مقارنة تراعي اختلاف عدد المهام</span></div><p className="monitor-rewards-rules"><Sparkles size={16} /> لكل مهمة مكتملة ١٠ نقاط، وقيد التنفيذ ضمن الموعد ٣ نقاط، وما عدا ذلك صفر. النتيجة من ١٠٠ = النقاط ÷ (عدد المهام × ١٠). هذه أداة تحفيز للجان، وليست تقييماً للأفراد.</p>{leaderboard.length ? <div className="monitor-leaderboard">{leaderboard.map((row, index) => <article key={`${row.department}-${row.committee}`}><span className="monitor-rank">{number.format(index + 1)}</span><div><strong>{row.committee}</strong><small>{row.department} · {number.format(row.completed)} مكتمل من {number.format(row.total)}</small></div><b>{number.format(score(row))}<small> / ١٠٠</small></b></article>)}</div> : <p className="monitor-rewards-empty">لا توجد نقاط مكتسبة بعد في هذا النطاق. يبدأ ترتيب اللجان عندما تُسجّل مهام مكتملة أو قيد التنفيذ ضمن الموعد.</p>}</section>
        <p className="monitor-note">لتحديث حالة مهمة أو مراجعة سبب تعثرها، افتح <a href={sitePage} target="_blank" rel="noreferrer">سجل SharePoint</a> بحساب الجامعة.</p>
      </>}
    </main><footer className="site-footer"><strong>أعمال اللجان</strong><span>كلية الشريعة والأنظمة</span></footer>
  </div>
}
