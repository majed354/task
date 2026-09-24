import type { CourseDetailRow } from './courseReportData'

const number = new Intl.NumberFormat('ar-SA-u-nu-latn')
const digits = (value: string) => value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
const percentage = (done: number, required: number) => required ? Math.round(done * 1000 / required) / 10 : 0

export interface CourseGroup {
  key: string
  code: string
  name: string
  term: string
  sections: CourseDetailRow[]
  done: number
  required: number
  combined: boolean
  combinedMeasurement: boolean
  unassignedPartial: number
}

export default function CourseItem({ course, selectedMember, department }: { course: CourseGroup; selectedMember: string; department: string }) {
  const personal = Boolean(selectedMember)
  const sections = personal ? course.sections.filter((row) => row.member === selectedMember && (department === 'كل الأقسام' || row.department === department)) : course.sections
  const covered = sections.filter((section) => section.report !== 'غير مسلّم').length
  const measured = sections.filter((section) => section.measurement).length
  const done = personal ? covered + measured : course.done
  const required = personal ? sections.length * 2 : course.required

  return <details className="course-item">
    <summary><span className="course-title"><strong>{course.name}</strong><small>{digits(course.term)} · {course.code} · {personal ? `${number.format(sections.length)} شعب للعضو من ${number.format(course.sections.length)}` : `${number.format(course.sections.length)} شعب`}</small></span><span className="course-progress"><strong>{number.format(percentage(done, required))}٪</strong><small>{number.format(done)} من {number.format(required)} متطلبًا {personal ? 'للعضو' : 'للمقرر'}</small>{personal && <small>المقرر ككل: {number.format(percentage(course.done, course.required))}٪</small>}</span></summary>
    <div className="course-item-body">
      <div className="course-item-totals"><span>تقارير الشعب: <strong>{number.format(covered)} من {number.format(sections.length)}</strong></span><span>قياس الشعب: <strong>{number.format(measured)} من {number.format(sections.length)}</strong></span><span>التقرير المجمع: <strong>{course.combined ? 'مسلّم' : 'غير مسلّم'}</strong></span><span>القياس المجمع: <strong>{course.combinedMeasurement ? 'مسلّم' : 'غير مسلّم'}</strong></span></div>
      {personal && <p className="monitor-note">التقرير والقياس المجمعان يخصان المقرر كله ولا يدخلان في نسبة العضو.</p>}
      {course.unassignedPartial > 0 && <p className="monitor-note">{number.format(course.unassignedPartial)} تقرير جزئي مستلم، لكن شعبه لم تُحدد بعد.</p>}
      <div className="monitor-table-wrap"><table className="course-table"><thead><tr><th>القسم</th><th>الشعبة التنظيمية</th><th>عضو هيئة التدريس</th><th>تقرير المقرر</th><th>قياس المخرجات</th></tr></thead><tbody>{sections.map((section) => <tr key={`${section.department}:${section.section}`}><td>{section.department}</td><td>{digits(section.section)}</td><td>{section.member || 'غير متاح'}</td><td>{section.report}</td><td>{section.measurement ? 'مسلّم' : 'غير مسلّم'}</td></tr>)}</tbody></table></div>
    </div>
  </details>
}
