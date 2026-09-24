import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpenCheck, CheckCircle2, ClipboardList, FileCheck2, FolderOpen, LayoutDashboard, RefreshCw, Target } from 'lucide-react'
import { CourseAccessError, courseReportScope, courseReportTerms, currentCourseReportTerm, loadCourseSnapshot, type CourseAccessScope, type CourseDetailRow, type CourseReportRow } from './courseReportData'
import MemberProgress from './MemberProgress'
import CourseItem, { type CourseGroup } from './CourseItem'

const number = new Intl.NumberFormat('ar-SA-u-nu-latn')
const digits = (value: string) => value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
const termLabel = (term: string) => term === 'all' ? 'جميع الفصول' : `الفصل ${digits(term)}`
const percentage = (done: number, total: number) => total ? Math.round(done * 1000 / total) / 10 : 0
function groupCourses(rows: CourseDetailRow[]): CourseGroup[] {
  const groups = new Map<string, CourseGroup>()
  for (const row of rows) {
    const key = `${row.term}:${row.code}`
    const existing = groups.get(key)
    if (existing) {
      if (existing.done !== row.done || existing.required !== row.required || existing.combined !== row.combined || existing.combinedMeasurement !== row.combinedMeasurement) throw new Error(`بيانات إنجاز غير متطابقة للمقرر ${row.code}.`)
      existing.sections.push(row)
    } else groups.set(key, { key, code: row.code, name: row.name, term: row.term, sections: [row], done: row.done, required: row.required, combined: row.combined, combinedMeasurement: row.combinedMeasurement, unassignedPartial: row.unassignedPartial })
  }
  for (const course of groups.values()) {
    const n = course.sections.length
    const covered = course.sections.filter((section) => section.report !== 'غير مسلّم').length
    const measured = course.sections.filter((section) => section.measurement).length
    const required = n === 1 ? 2 : n * 2 + 2
    const done = n === 1 ? Number(covered > 0 || course.combined) + Number(measured > 0 || course.combinedMeasurement) : covered + measured + Number(course.combined) + Number(course.combinedMeasurement)
    if (course.required !== required || course.done !== done) throw new Error(`نسبة إنجاز المقرر ${course.code} لا تطابق أدلته.`)
  }
  return [...groups.values()].sort((a, b) => percentage(b.done, b.required) - percentage(a.done, a.required) || a.code.localeCompare(b.code, 'en', { numeric: true }))
}

function Metric({ title, done, total, icon }: { title: string; done: number; total: number; icon: ReactNode }) {
  const progress = percentage(done, total)
  return <article className="course-metric"><span>{icon}{title}</span><strong>{number.format(done)} <small>من {number.format(total)}</small></strong><div className="monitor-mini-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={title}><i style={{ width: `${progress}%` }} /></div><small>{number.format(progress)}٪ مكتمل · {number.format(total - done)} بانتظار التسليم</small></article>
}

export default function CourseReportsDashboard() {
  const [scope, setScope] = useState<CourseAccessScope | null>(null)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [rows, setRows] = useState<CourseReportRow[]>([])
  const [details, setDetails] = useState<CourseDetailRow[]>([])
  const [term, setTerm] = useState(currentCourseReportTerm)
  const [department, setDepartment] = useState('كل الأقسام')
  const [selectedMember, setSelectedMember] = useState('')
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(40)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setBusy(true); setError('')
    try {
      const { scope: accessScope, aggregates, sections } = await loadCourseSnapshot()
      const courses = groupCourses(sections)
      for (const code of courseReportTerms) {
        const all = aggregates.find((row) => row.term === code && row.department === (accessScope === 'all' ? 'كل الأقسام' : accessScope))
        const actual = sections.filter((row) => row.term === code)
        if (!all || actual.length !== all.sections || courses.filter((course) => course.term === code).length !== all.courses || actual.filter((row) => row.report !== 'غير مسلّم').length !== all.anyReport) throw new Error(`تفاصيل الفصل ${code} لا تطابق ورقة المؤشرات.`)
      }
      setScope(accessScope); setRows(aggregates); setDetails(sections)
      setDepartment((current) => accessScope === 'all' ? current : accessScope)
      setSelectedMember((name) => !name || sections.some((row) => row.member === name) ? name : '')
    } catch (cause) {
      if (cause instanceof CourseAccessError && cause.status === 401) { setScope(null); setRows([]); setDetails([]) }
      else setError(cause instanceof Error ? cause.message : 'تعذّر تحميل تقارير المقررات.')
    }
    finally { setBusy(false) }
  }, [])
  useEffect(() => { document.title = 'لوحة متابعة تقارير المقررات — كلية الشريعة والأنظمة'; void refresh() }, [refresh])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true); setLoginError('')
    try {
      const response = await fetch('/api/course/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      if (!response.ok) throw new Error(response.status === 401 ? 'كلمة المرور غير صحيحة.' : response.status === 429 ? 'محاولات كثيرة. حاول بعد عشر دقائق.' : 'تعذّر تسجيل الدخول الآن.')
      setPassword('')
      await refresh()
    } catch (cause) { setLoginError(cause instanceof Error ? cause.message : 'تعذّر تسجيل الدخول الآن.') }
    finally { setBusy(false) }
  }

  const logout = async () => {
    await fetch('/api/course/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined)
    setScope(null); setRows([]); setDetails([]); setDepartment('كل الأقسام'); setSelectedMember(''); setPassword('')
  }

  const scoped = useMemo(() => courseReportScope(rows, term), [rows, term])
  const current = scoped.find((row) => row.department === department)
  const departmentRows = scoped.filter((row) => row.department !== 'كل الأقسام')
  const allCourses = useMemo(() => groupCourses(details.filter((row) => term === 'all' || row.term === term)), [details, term])
  const departmentCourses = useMemo(() => department === 'كل الأقسام' ? allCourses : allCourses.filter((course) => course.sections.some((row) => row.department === department)), [allCourses, department])
  const memberRows = useMemo(() => details.filter((row) => (term === 'all' || row.term === term) && (department === 'كل الأقسام' || row.department === department)), [details, term, department])
  const memberCourses = useMemo(() => selectedMember ? departmentCourses.filter((course) => course.sections.some((row) => row.member === selectedMember && (department === 'كل الأقسام' || row.department === department))) : departmentCourses, [departmentCourses, selectedMember, department])
  const shownCourses = useMemo(() => memberCourses.filter((course) => !query.trim() || `${course.code} ${course.name}`.includes(query.trim())).slice(0, visible), [memberCourses, query, visible])
  const filteredCount = useMemo(() => memberCourses.filter((course) => !query.trim() || `${course.code} ${course.name}`.includes(query.trim())).length, [memberCourses, query])
  const lastChecked = rows.reduce((latest, row) => row.checkedAt > latest ? row.checkedAt : latest, '')
  const checkedTime = lastChecked ? Date.parse(lastChecked) : NaN
  const checkedLabel = Number.isFinite(checkedTime) ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }).format(checkedTime) : '—'
  const oldData = Number.isFinite(checkedTime) && Date.now() - checkedTime > 3 * 60 * 60 * 1000
  const totalEvidence = departmentCourses.reduce((total, course) => total + course.required, 0)
  const submittedEvidence = departmentCourses.reduce((total, course) => total + course.done, 0)
  const overallProgress = percentage(submittedEvidence, totalEvidence)
  const singleSectionCourses = departmentCourses.filter((course) => course.sections.length === 1).length

  if (!scope) return <div className="app-shell monitoring-shell" dir="rtl">
    <header className="topbar" id="top"><a className="brand" href="/"><span className="brand-mark"><BookOpenCheck size={23} /></span><span><small>كلية الشريعة والأنظمة</small><strong>متابعة الجودة</strong></span></a><nav className="topnav monitor-topnav" aria-label="أقسام الموقع"><a className="portal-tab" href="/">دليل أعمال اللجان</a><a className="portal-tab" href="/?view=dashboard">لوحة متابعة اللجان</a><a className="portal-tab is-current" href="/?view=course-reports" aria-current="page">تقارير المقررات</a></nav></header>
    <main className="monitor-main"><section className="monitor-panel course-login"><h1>لوحة تقارير المقررات</h1><p>أدخل كلمة المرور المخصصة للعرض الكلي أو لقسمك. بعد الدخول تُعرض بيانات نطاقك داخل اللوحة.</p><form onSubmit={(event) => void login(event)}><label>كلمة المرور<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><button type="submit" disabled={busy}>{busy ? 'جارٍ التحقق…' : 'دخول'}</button></form>{loginError && <p className="monitor-error" role="alert">{loginError}</p>}{error && <p className="monitor-error" role="alert">{error}</p>}</section></main>
  </div>

  return <div className="app-shell monitoring-shell" dir="rtl">
    <header className="topbar" id="top"><a className="brand" href="/" aria-label="دليل أعمال اللجان"><span className="brand-mark"><BookOpenCheck size={23} /></span><span><small>كلية الشريعة والأنظمة</small><strong>متابعة الجودة</strong></span></a><nav className="topnav monitor-topnav" aria-label="أقسام الموقع"><a className="portal-tab" href="/">دليل أعمال اللجان</a><a className="portal-tab" href="/?view=dashboard">لوحة متابعة اللجان</a><a className="portal-tab is-current" href="/?view=course-reports" aria-current="page">تقارير المقررات</a></nav><button className="monitor-header-link" type="button" onClick={() => void logout()}>تسجيل الخروج</button></header>
    <main className="monitor-main">
      <section className="monitor-hero"><div><span className="monitor-eyebrow"><LayoutDashboard size={17} /> متابعة تقارير المقررات</span><h1>من الشعبة إلى التقرير المجمع</h1><p>نحسب تقرير كل شعبة وقياس مخرجاتها، ثم التقرير والقياس المجمعين للمقرر. تظهر التقارير الجزئية للشعب التي تغطيها فعلاً، ويبقى ما لم تُحدد شعبه بانتظار المطابقة.</p></div><div className="monitor-hero-badge"><span>الفصل الجاري متابعته</span><strong>٤٧٢</strong><small>الاختيار الافتراضي</small></div></section>
      <div className="monitor-toolbar"><span className="monitor-account">آخر فحص للمجلدات: {checkedLabel}</span><button type="button" onClick={() => void refresh()} disabled={busy}><RefreshCw size={16} /> {busy ? 'جارٍ التحديث' : 'تحديث العرض'}</button></div>
      {error && <p className="monitor-error" role="alert">{error}</p>}{oldData && <p className="monitor-error" role="status">آخر فحص للمجلدات أقدم من ثلاث ساعات. الأرقام المعروضة هي آخر ما نُشر في ورقة المؤشرات.</p>}
      <section className="monitor-control-panel" aria-label="تصفية تقارير المقررات"><div className="monitor-panel-head"><h2>نطاق العرض</h2><span>{scope === 'all' ? 'يمكن الجمع بين الفصول أو عرض قسم واحد' : `العرض مقصور على ${scope}`}</span></div><div className="monitor-filters"><label>الفصل<select value={term} onChange={(event) => { setTerm(event.target.value); if (scope === 'all') setDepartment('كل الأقسام'); setSelectedMember(''); setVisible(40) }}><option value="all">جميع الفصول</option>{courseReportTerms.map((code) => <option key={code} value={code}>{termLabel(code)}</option>)}</select></label>{scope === 'all' && <label>القسم<select value={department} onChange={(event) => { setDepartment(event.target.value); setSelectedMember(''); setVisible(40) }}><option>كل الأقسام</option>{departmentRows.map((row) => <option key={row.department}>{row.department}</option>)}</select></label>}</div><p className="monitor-source-line">تُعرض بيانات {scope === 'all' ? 'كل الأقسام' : scope} عبر اتصال محمي. ٤٨١ هيكل جاهز، وتبدأ بيانات التدريس المتاحة من ٤٦١ إلى ٤٧٢.</p></section>
      {!rows.length && !error && <div className="monitor-gate">جارٍ تحميل بيانات تقارير المقررات…</div>}
      {current && <>
        <section className="course-summary" aria-label="ملخص نطاق التقارير"><div><span><FolderOpen size={18} /> الشعب في النطاق</span><strong>{number.format(current.sections)}</strong><small>{termLabel(term)} · {department}</small></div><div><span><ClipboardList size={18} /> المقررات في النطاق</span><strong>{number.format(departmentCourses.length)}</strong><small>{number.format(singleSectionCourses)} منها ذات شعبة واحدة</small></div><div className="course-summary-progress"><span><CheckCircle2 size={18} /> اكتمال الأدلة</span><strong>{number.format(overallProgress)}٪</strong><small>{number.format(submittedEvidence)} من {number.format(totalEvidence)} متطلب</small></div></section>
        <section className="course-metrics" aria-label="حالة التسليم"><Metric title="تقارير الشعب المغطاة" done={current.anyReport} total={current.sections} icon={<FileCheck2 size={18} />} /><Metric title="قياس مخرجات الشعب" done={current.measurements} total={current.sections} icon={<Target size={18} />} /><Metric title="التقارير المجمعة" done={current.combined} total={current.courses} icon={<ClipboardList size={18} />} /><Metric title="قياسات المخرجات المجمعة" done={current.combinedMeasurements} total={current.courses} icon={<Target size={18} />} /></section>
        <p className="monitor-note" role="status">من تقارير الشعب المغطاة {number.format(current.reports)} مستقل و{number.format(current.partialCovered)} تغطيها تقارير جزئية؛ وقد تتداخل الفئتان. استُلِم {number.format(current.partialReports)} تقريرًا جزئيًا، منها {number.format(current.unassignedPartial)} بانتظار تعيين الشعب. {current.combinedWithMissingSections ? `هناك ${number.format(current.combinedWithMissingSections)} مقررًا له تقرير مجمع مع نقص في تقارير بعض شعبه.` : ''} المقرر ذو الشعبة الواحدة له متطلبان فقط: تقرير وقياس، ويكفي رفع كل منهما مرة واحدة.</p>
        <MemberProgress rows={memberRows} selected={selectedMember} onSelect={(name) => { setSelectedMember(name); setQuery(''); setVisible(40) }} />
        <section className="monitor-panel">
          <div className="monitor-panel-head"><h2>{selectedMember ? `مقررات ${selectedMember}` : 'إنجاز كل مقرر وشعبه'}</h2><span>افتح المقرر لرؤية حالة كل شعبة</span></div>
          <label className="course-search">البحث برمز المقرر أو اسمه<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(40) }} placeholder="مثال: 2001421 أو فقه" /></label>
          <p className="course-formula">للمقرر متعدد الشعب: المتطلبات = تقرير وقياس لكل شعبة + تقرير وقياس مجمعان. مثال: ٤ شعب، وتقرير شعبة واحدة فقط = ١ من ١٠ = ١٠٪. عند تحديد عضو تظهر نسبة متطلبات شعبه وحدها.</p>
          <div className="course-list">{shownCourses.map((course) => <CourseItem key={course.key} course={course} selectedMember={selectedMember} department={department} />)}</div>
          {visible < filteredCount && <button className="course-more" type="button" onClick={() => setVisible((count) => count + 40)}>عرض المزيد ({number.format(filteredCount - visible)})</button>}
          {filteredCount === 0 && <p className="monitor-note">لا توجد مقررات تطابق البحث.</p>}
        </section>
        <section className="monitor-panel"><div className="monitor-panel-head"><h2>{scope === 'all' ? 'الأقسام الأربعة' : scope}</h2><span>التغطية تشمل التقرير المستقل أو الجزئي المسند إلى الشعبة</span></div><div className="monitor-table-wrap"><table className="course-table"><thead><tr><th>القسم</th><th>الشعب</th><th>شعب لها تقرير</th><th>قياس الشعب</th><th>المقررات</th><th>التقرير المجمع</th><th>القياس المجمع</th></tr></thead><tbody>{departmentRows.map((row) => <tr key={row.department}><td><strong>{row.department}</strong></td><td>{number.format(row.sections)}</td><td>{number.format(row.anyReport)} / {number.format(row.sections)}</td><td>{number.format(row.measurements)} / {number.format(row.sections)}</td><td>{number.format(row.courses)}</td><td>{number.format(row.combined)} / {number.format(row.courses)}</td><td>{number.format(row.combinedMeasurements)} / {number.format(row.courses)}</td></tr>)}</tbody></table></div></section>
        <p className="monitor-note">«غير مسلّم» تعني أن ملف التسليم لم يظهر في مجلده عند آخر فحص؛ لا تعني التأخر دون موعد معتمد. عند تصفية قسم، تظهر نسبة المقرر كاملاً إذا دُرّس في أكثر من قسم.</p>
      </>}
    </main><footer className="site-footer"><strong>متابعة الجودة</strong><span>كلية الشريعة والأنظمة</span></footer>
  </div>
}
