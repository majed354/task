import { useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { courseReportTerms, currentCourseReportTerm } from './courseReportData'

const digits = (value: string) => value.replace(/\d/g, (digit) => '٠١٢٣٤٥٦٧٨٩'[Number(digit)])
export const selectedTermsLabel = (terms: readonly string[]) => terms.length === courseReportTerms.length ? 'جميع الفصول' : `${terms.length === 1 ? 'الفصل' : 'الفصول'} ${terms.map(digits).join('، ')}`

export default function TermMultiSelect({ value, onChange }: { value: string[]; onChange: (terms: string[]) => void }) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const toggle = (term: string) => {
    const next = value.includes(term) ? value.filter((code) => code !== term) : [...value, term]
    if (next.length) onChange(courseReportTerms.filter((code) => next.includes(code)))
  }
  return <div className="term-multi-select" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={(event) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus() }
  }}>
    <label id={`${id}-label`} htmlFor={`${id}-trigger`}>الفصول الدراسية</label>
    <button id={`${id}-trigger`} ref={trigger} className="term-multi-trigger" type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-options`} onClick={() => setOpen(!open)}>
      <span id={`${id}-value`}>{selectedTermsLabel(value)}</span><ChevronDown size={16} />
    </button>
    {open && <div className="term-multi-popup" id={`${id}-options`} role="group" aria-labelledby={`${id}-label`}>
      <p>حدد فصلًا واحدًا أو أكثر</p>
      {courseReportTerms.map((term) => <label key={term} className={value.includes(term) ? 'is-selected' : ''}>
        <input type="checkbox" checked={value.includes(term)} disabled={value.length === 1 && value[0] === term} onChange={() => toggle(term)} />
        <span>الفصل {digits(term)}</span>
      </label>)}
      <div className="term-multi-actions"><button type="button" onClick={() => onChange([...courseReportTerms])}>تحديد جميع الفصول</button><button type="button" onClick={() => onChange([currentCourseReportTerm])}>الفصل الحالي فقط</button></div>
    </div>}
  </div>
}
