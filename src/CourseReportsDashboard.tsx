import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowUpLeft, BookOpenCheck, CheckCircle2, ClipboardList, FileCheck2, FolderOpen, LayoutDashboard, RefreshCw, Target } from 'lucide-react'
import { courseReportScope, courseReportSheet, courseReportTerms, currentCourseReportTerm, loadCourseReports, type CourseReportRow } from './courseReportData'

const number = new Intl.NumberFormat('ar-SA-u-nu-latn')
const digits = (value: string) => value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
const termLabel = (term: string) => term === 'all' ? 'جميع الفصول' : `الفصل ${digits(term)}`
const percentage = (done: number, total: number) => total ? Math.round(done * 1000 / total) / 10 : 0
const sharePointFolder = (term: string) => {
  const base = '/sites/msteams_3b4354/Shared Documents/متابعة تقارير المقررات/1-التقارير'
  const path = term === 'all' ? base : `${base}/${digits(term)}`
  return `https://taifedusa.sharepoint.com/sites/msteams_3b4354/Shared%20Documents/Forms/AllItems.aspx?id=${encodeURIComponent(path)}`
}

function Metric({ title, done, total, icon }: { title: string; done: number; total: number; icon: ReactNode }) {
  const progress = percentage(done, total)
  return <article className="course-metric">
    <span>{icon}{title}</span>
    <strong>{number.format(done)} <small>من {number.format(total)}</small></strong>
    <div className="monitor-mini-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={title}><i style={{ width: `${progress}%` }} /></div>
    <small>{number.format(progress)}٪ مكتمل · {number.format(total - done)} بانتظار التسليم</small>
  </article>
}

export default function CourseReportsDashboard() {
  const [rows, setRows] = useState<CourseReportRow[]>([])
  const [term, setTerm] = useState(currentCourseReportTerm)
  const [department, setDepartment] = useState('كل الأقسام')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setBusy(true); setError('')
    try { setRows(await loadCourseReports()) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر تحميل مؤشرات تقارير المقررات.') }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { document.title = 'لوحة متابعة تقارير المقررات — كلية الشريعة والأنظمة'; void refresh() }, [refresh])

  const scoped = useMemo(() => courseReportScope(rows, term), [rows, term])
  const current = scoped.find((row) => row.department === department)
  const departmentRows = scoped.filter((row) => row.department !== 'كل الأقسام')
  const lastChecked = rows.reduce((latest, row) => row.checkedAt > latest ? row.checkedAt : latest, '')
  const checkedTime = lastChecked ? Date.parse(lastChecked) : NaN
  const checkedLabel = Number.isFinite(checkedTime)
    ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(checkedTime)
    : '—'
  const oldData = Number.isFinite(checkedTime) && Date.now() - checkedTime > 24 * 60 * 60 * 1000
  const totalEvidence = current ? current.sections * 2 + current.courses : 0
  const submittedEvidence = current ? current.reports + current.measurements + current.combined : 0
  const overallProgress = percentage(submittedEvidence, totalEvidence)

  return <div className="app-shell monitoring-shell" dir="rtl">
    <header className="topbar" id="top">
      <a className="brand" href="/" aria-label="دليل أعمال اللجان"><span className="brand-mark"><BookOpenCheck size={23} /></span><span><small>كلية الشريعة والأنظمة</small><strong>متابعة الجودة</strong></span></a>
      <nav className="topnav monitor-topnav" aria-label="أقسام الموقع"><a className="portal-tab" href="/">دليل أعمال اللجان</a><a className="portal-tab" href="/?view=dashboard">لوحة متابعة اللجان</a><a className="portal-tab is-current" href="/?view=course-reports" aria-current="page">تقارير المقررات</a></nav>
      <a className="monitor-header-link" href={courseReportSheet} target="_blank" rel="noreferrer">ورقة المؤشرات <ArrowUpLeft size={15} /></a>
    </header>
    <main className="monitor-main">
      <section className="monitor-hero"><div><span className="monitor-eyebrow"><LayoutDashboard size={17} /> متابعة تقارير المقررات</span><h1>من الشعبة إلى التقرير المجمع</h1><p>تظهر هنا أعداد تسليم تقرير كل شعبة، وقياس مخرجات تعلمها، والتقرير المجمع لكل مقرر. تُقرأ المؤشرات المجمّعة من ورقة Google Sheets المشتركة مع لوحة اللجان.</p></div><div className="monitor-hero-badge"><span>الفصل الجاري متابعته</span><strong>٤٧٢</strong><small>الاختيار الافتراضي</small></div></section>
      <div className="monitor-toolbar"><span className="monitor-account">آخر فحص للمجلدات: {checkedLabel}</span><button type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> {busy ? 'جارٍ التحديث' : 'تحديث العرض'}</button></div>
      {error && <p className="monitor-error" role="alert">{error}</p>}
      {oldData && <p className="monitor-error" role="status">آخر فحص للمجلدات أقدم من يوم. الأرقام المعروضة هي آخر ما نُشر في ورقة المؤشرات.</p>}
      <section className="monitor-control-panel" aria-label="تصفية تقارير المقررات"><div className="monitor-panel-head"><h2>نطاق العرض</h2><span>يمكن الجمع بين الفصول أو عرض قسم واحد</span></div><div className="monitor-filters">
        <label>الفصل<select value={term} onChange={(event) => { setTerm(event.target.value); setDepartment('كل الأقسام') }}><option value="all">جميع الفصول</option>{courseReportTerms.map((code) => <option key={code} value={code}>{termLabel(code)}</option>)}</select></label>
        <label>القسم<select value={department} onChange={(event) => setDepartment(event.target.value)}><option>كل الأقسام</option>{departmentRows.map((row) => <option key={row.department}>{row.department}</option>)}</select></label>
      </div><p className="monitor-source-line">المصدر العام: <a href={courseReportSheet} target="_blank" rel="noreferrer">مؤشرات تقارير المقررات</a> · <a href={sharePointFolder(term)} target="_blank" rel="noreferrer">مجلد {termLabel(term)} في SharePoint</a> · ٤٨١ هيكل جاهز، وتبدأ بيانات التدريس المتاحة من ٤٦١ إلى ٤٧٢.</p></section>
      {!rows.length && !error && <div className="monitor-gate">جارٍ تحميل بيانات تقارير المقررات…</div>}
      {current && <>
        <section className="course-summary" aria-label="ملخص نطاق التقارير"><div><span><FolderOpen size={18} /> الشعب في النطاق</span><strong>{number.format(current.sections)}</strong><small>{termLabel(term)} · {department}</small></div><div><span><ClipboardList size={18} /> المقررات في النطاق</span><strong>{number.format(current.courses)}</strong><small>يُحسب التقرير المجمع مرة لكل رمز مقرر</small></div><div className="course-summary-progress"><span><CheckCircle2 size={18} /> اكتمال الأدلة</span><strong>{number.format(overallProgress)}٪</strong><small>{number.format(submittedEvidence)} من {number.format(totalEvidence)} تسليم متوقع</small></div></section>
        <section className="course-metrics" aria-label="حالة التسليم"><Metric title="تقارير الشعب" done={current.reports} total={current.sections} icon={<FileCheck2 size={18} />} /><Metric title="قياس مخرجات تعلم المقرر للشعب" done={current.measurements} total={current.sections} icon={<Target size={18} />} /><Metric title="التقارير المجمعة للمقررات" done={current.combined} total={current.courses} icon={<ClipboardList size={18} />} /></section>
        <p className="monitor-note" role="status">{current.combinedWithMissingSections > 0 ? `المقررات ذات التقرير المجمع مع نقص تقارير بعض شعبها: ${number.format(current.combinedWithMissingSections)}. يُحتسب التقرير المجمع مع إبقاء تقارير الشعب الناقصة معلّقة.` : 'لا توجد تقارير مجمعة مع نقص ظاهر في تقارير الشعب ضمن هذا النطاق.'} المقرر ذو الشعبة الواحدة يكفيه تقرير واحد ويُحتسب للشعبة وللمقرر المجمع.</p>
        <section className="monitor-panel"><div className="monitor-panel-head"><h2>الأقسام الأربعة</h2><span>اضغط اسم القسم في المرشح لعرض تفاصيله</span></div><div className="monitor-table-wrap"><table className="course-table"><thead><tr><th>القسم</th><th>الشعب</th><th>تقارير الشعب</th><th>قياس المخرجات</th><th>المقررات</th><th>التقارير المجمعة</th><th>مجمعة مع نقص تقارير الشعب</th></tr></thead><tbody>{departmentRows.map((row) => <tr key={row.department}><td><strong>{row.department}</strong></td><td>{number.format(row.sections)}</td><td>{number.format(row.reports)} / {number.format(row.sections)}</td><td>{number.format(row.measurements)} / {number.format(row.sections)}</td><td>{number.format(row.courses)}</td><td>{number.format(row.combined)} / {number.format(row.courses)}</td><td>{number.format(row.combinedWithMissingSections)}</td></tr>)}</tbody></table></div></section>
        <p className="monitor-note">المعلّق يعني أن ملف التسليم لم يظهر في مجلده عند آخر فحص؛ لا يُعدّ متأخراً دون موعد تسليم معتمد. وقد يدرّس المقرر أكثر من قسم، لذا لا يساوي مجموع مقررات الأقسام بالضرورة إجمالي المقررات الفريدة.</p>
      </>}
    </main><footer className="site-footer"><strong>متابعة الجودة</strong><span>كلية الشريعة والأنظمة</span></footer>
  </div>
}
