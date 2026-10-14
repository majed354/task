import type { CourseDetailRow } from './courseReportData'
import ReportFolderLink from './ReportFolderLink'
import ReportExecutionLink from './ReportExecutionLink'
import SectionNumber from './SectionNumber'

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

export default function CourseItem({ course, selectedMember, department, expanded = false }: { course: CourseGroup; selectedMember: string; department: string; expanded?: boolean }) {
  const personal = Boolean(selectedMember)
  const sections = course.sections.filter((row) => (department === 'كل الأقسام' || row.department === department) && (!personal || row.member === selectedMember))
  const folders = sections[0]?.folders
  const covered = sections.filter((section) => section.report !== 'غير مسلّم').length
  const measured = sections.filter((section) => section.measurement).length
  const done = personal ? covered + measured : course.done
  const required = personal ? sections.length * 2 : course.required

  return <details className="course-item" open={personal || expanded || undefined}>
    <summary><span className="course-title"><strong>{course.name}</strong><small>{digits(course.term)} · {course.code} · {personal ? `${number.format(sections.length)} شعب للعضو من ${number.format(course.sections.length)}` : `${number.format(course.sections.length)} شعب`}</small></span><span className="course-progress"><strong>{number.format(percentage(done, required))}٪</strong><small>{number.format(done)} من {number.format(required)} متطلبًا {personal ? 'للعضو' : 'للمقرر'}</small>{personal && <small>المقرر ككل: {number.format(percentage(course.done, course.required))}٪</small>}</span></summary>
    <div className="course-item-body">
      <div className="course-item-totals"><span>تقارير الشعب: <strong>{number.format(covered)} من {number.format(sections.length)}</strong></span><span>قياس الشعب: <strong>{number.format(measured)} من {number.format(sections.length)}</strong></span></div>
      {course.sections.length > 1 && <div className="course-combined-actions"><div><span>التقرير المجمع للمقرر</span><strong>{course.combined ? 'مسلّم' : 'غير مسلّم'}</strong><ReportFolderLink path={folders?.combined} delivered={course.combined} label={`التقرير المجمع لمقرر ${course.name}`} />{sections[0] && <ReportExecutionLink section={sections[0]} kind="combined" />}</div><div><span>قياس مخرجات المقرر المجمع</span><strong>{course.combinedMeasurement ? 'مسلّم' : 'غير مسلّم'}</strong><ReportFolderLink path={folders?.combinedMeasurement} delivered={course.combinedMeasurement} label={`قياس المخرجات المجمع لمقرر ${course.name}`} />{sections[0] && <ReportExecutionLink section={sections[0]} kind="combinedMeasurement" />}</div></div>}
      <p className="monitor-note">«تنفيذ التقرير» و«تنفيذ القياس» يجهزان المتطلب في خدمة التقارير. رابط الرفع يفتح المجلد المخصص لهذا المتطلب في التيم. اختر «تحميل» لإضافة ملفك بحساب الجامعة؛ تتحدث حالة التسليم بعد الفحص التالي.</p>
      {personal && <p className="monitor-note">التقرير والقياس المجمعان يخصان المقرر كله ولا يدخلان في نسبة العضو.</p>}
      {course.unassignedPartial > 0 && <p className="monitor-note">{number.format(course.unassignedPartial)} تقرير جزئي مستلم، لكن شعبه لم تُحدد بعد.</p>}
      <div className="monitor-table-wrap"><table className="course-table"><thead><tr><th>القسم</th><th>رقم الشعبة</th><th>عضو هيئة التدريس</th><th>تقرير المقرر</th><th>قياس المخرجات</th></tr></thead><tbody>{sections.map((section) => <tr key={`${section.department}:${section.section}`}><td>{section.department}</td><td><SectionNumber row={section} /></td><td>{section.member || 'غير متاح'}</td><td><div className="report-delivery"><span>{section.report}</span><ReportFolderLink path={section.folders?.report} delivered={section.report !== 'غير مسلّم'} label={`تقرير ${course.name} للشعبة ${section.officialNumber?.officialSection || 'غير المطابقة'} لدى ${section.member}`} /><ReportExecutionLink section={section} kind="report" /></div></td><td><div className="report-delivery"><span>{section.measurement ? 'مسلّم' : 'غير مسلّم'}</span><ReportFolderLink path={section.folders?.measurement} delivered={section.measurement} label={`قياس مخرجات ${course.name} للشعبة ${section.officialNumber?.officialSection || 'غير المطابقة'} لدى ${section.member}`} /><ReportExecutionLink section={section} kind="measurement" /></div></td></tr>)}</tbody></table></div>
    </div>
  </details>
}
