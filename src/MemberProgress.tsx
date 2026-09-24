import { useMemo, useState } from 'react'
import type { CourseDetailRow } from './courseReportData'
import { summarizeMembers } from './memberProgressData'

const number = new Intl.NumberFormat('ar-SA-u-nu-latn')
const percentage = (done: number, required: number) => required ? Math.round(done * 1000 / required) / 10 : 0

interface Props {
  rows: CourseDetailRow[]
  selected: string
  onSelect: (name: string) => void
}

export default function MemberProgress({ rows, selected, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [visible, setVisible] = useState(20)
  const [sortBy, setSortBy] = useState<'progress' | 'name'>('progress')
  const members = useMemo(() => summarizeMembers(rows), [rows])
  const filtered = useMemo(() => members.filter((member) => member.name.includes(query.trim())).sort((a, b) => sortBy === 'progress' ? (b.done / b.required - a.done / a.required) || a.name.localeCompare(b.name, 'ar') : a.name.localeCompare(b.name, 'ar')), [members, query, sortBy])
  const active = members.find((member) => member.name === selected)

  return <section className="monitor-panel member-panel" aria-label="إنجاز أعضاء هيئة التدريس">
    <div className="monitor-panel-head"><h2>إنجاز أعضاء هيئة التدريس</h2><span>{number.format(members.length)} عضوًا في النطاق</span></div>
    <p className="monitor-note">نسبة العضو = تقارير شعبه وقياسات مخرجاتها المسلّمة ÷ متطلبين لكل شعبة مسندة إليه. تُعرض التقارير والقياسات المجمعة مع المقرر، ولا تُنسب إلى عضو بعينه دون إسناد صريح.</p>
    {!members.length ? <p className="monitor-note">لم تُنشر بيانات إسناد الأعضاء في ورقة التفاصيل بعد.</p> : <>
      <div className="member-toolbar"><label className="course-search">البحث باسم العضو<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setVisible(20) }} placeholder="اكتب اسم عضو هيئة التدريس" /></label><label className="member-sort">ترتيب الأعضاء<select value={sortBy} onChange={(event) => { setSortBy(event.target.value as 'progress' | 'name'); setVisible(20) }}><option value="progress">الأعلى إنجازًا</option><option value="name">الاسم أبجديًا</option></select></label>{selected && <button type="button" className="member-clear" onClick={() => onSelect('')}>عرض جميع الأعضاء</button>}</div>
      {active && <div className="member-focus" role="status"><div><span>العضو المحدد</span><strong>{active.name}</strong><small>{number.format(active.courses)} مقررات · {number.format(active.sections)} شعب</small></div><div><span>تقارير الشعب</span><strong>{number.format(active.reports)} من {number.format(active.sections)}</strong><small>{number.format(active.independentReports)} مستقل · {number.format(active.partialReports)} تغطية جماعية</small></div><div><span>قياس المخرجات</span><strong>{number.format(active.measurements)} من {number.format(active.sections)}</strong></div><div><span>إنجاز متطلبات العضو</span><strong>{number.format(percentage(active.done, active.required))}٪</strong><small>{number.format(active.done)} من {number.format(active.required)} متطلبًا</small></div></div>}
      <div className="monitor-table-wrap"><table className="course-table member-table"><thead><tr><th>عضو هيئة التدريس</th><th>المقررات</th><th>الشعب</th><th>تقارير الشعب</th><th>قياس المخرجات</th><th>الإنجاز</th></tr></thead><tbody>{filtered.slice(0, visible).map((member) => <tr key={member.name} className={member.name === selected ? 'is-selected' : ''}><td><button type="button" className="member-name" aria-pressed={member.name === selected} onClick={() => onSelect(member.name)}>{member.name}</button></td><td>{number.format(member.courses)}</td><td>{number.format(member.sections)}</td><td>{number.format(member.reports)} من {number.format(member.sections)}</td><td>{number.format(member.measurements)} من {number.format(member.sections)}</td><td><strong>{number.format(percentage(member.done, member.required))}٪</strong><small>{number.format(member.done)} من {number.format(member.required)}</small></td></tr>)}</tbody></table></div>
      {visible < filtered.length && <button className="course-more" type="button" onClick={() => setVisible((count) => count + 20)}>عرض المزيد ({number.format(filtered.length - visible)})</button>}
      {filtered.length === 0 && <p className="monitor-note">لا يوجد عضو يطابق الاسم المدخل.</p>}
    </>}
  </section>
}
