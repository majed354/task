import type { CourseDetailRow } from './courseReportData'

const digits = (value: string) => value.replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])

export default function SectionNumber({ row }: { row?: CourseDetailRow }) {
  const match = row?.officialNumber
  if (match?.status === 'matched') return <strong className="official-section-number" title={`من النتائج: ${match.sourceFiles.join('، ')}`}>{digits(match.officialSection)}</strong>
  return <span className="section-number-unresolved">{match?.status === 'ambiguous' ? 'بحاجة للمطابقة' : 'غير متاح في النتائج'}
    {match?.candidates.length ? <small>أرقام النتائج: {match.candidates.map(digits).join('، ')}</small> : null}
  </span>
}
