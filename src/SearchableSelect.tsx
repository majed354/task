import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { matchesArabicSearch } from './arabicSearch'

export interface SearchOption { value: string; label: string }
interface Props {
  label: string
  placeholder: string
  allLabel: string
  options: SearchOption[]
  value: string
  query: string
  onQueryChange: (query: string) => void
  onSelect: (value: string, label: string) => void
}

export default function SearchableSelect({ label, placeholder, allLabel, options, value, query, onQueryChange, onSelect }: Props) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRef = useRef<HTMLLIElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const selected = options.find((option) => option.value === value)
  const filterQuery = selected?.label === query ? '' : query
  const filtered = useMemo(() => options.filter((option) => matchesArabicSearch(option.label, filterQuery)), [options, filterQuery])
  const choices = filterQuery.trim() ? filtered : [{ value: '', label: allLabel }, ...filtered]
  const highlighted = Math.min(activeIndex, choices.length - 1)
  useEffect(() => { if (open) activeRef.current?.scrollIntoView({ block: 'nearest' }) }, [open, highlighted, filterQuery])

  const choose = (option: SearchOption) => {
    onSelect(option.value, option.value ? option.label : '')
    setOpen(false)
    setActiveIndex(0)
  }

  return <div className="searchable-select" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <label htmlFor={`${id}-input`}>{label}</label>
    <div className="searchable-select-field">
      <Search size={17} aria-hidden="true" />
      <input id={`${id}-input`} ref={inputRef} role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`} aria-activedescendant={open && highlighted >= 0 ? `${id}-option-${highlighted}` : undefined} placeholder={placeholder} value={query}
        onFocus={(event) => { setOpen(true); setActiveIndex(0); event.currentTarget.select() }}
        onClick={() => { setOpen(true); setActiveIndex(0) }}
        onChange={(event) => { onQueryChange(event.target.value); setActiveIndex(0); setOpen(true) }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
            setActiveIndex((index) => !open ? 0 : Math.max(0, Math.min(choices.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1))))
          } else if (event.key === 'Enter' && open) {
            event.preventDefault()
            if (choices[highlighted]) choose(choices[highlighted])
          } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
        }} />
      {query && <button type="button" className="searchable-select-clear" aria-label={`مسح ${label}`} onClick={() => { inputRef.current?.focus(); choose({ value: '', label: allLabel }) }}><X size={16} /></button>}
      <button type="button" className="searchable-select-toggle" aria-label={`${open ? 'إغلاق' : 'فتح'} قائمة ${label}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { if (open) setOpen(false); else { inputRef.current?.focus(); setOpen(true); setActiveIndex(0) } }}><ChevronDown size={18} /></button>
    </div>
    {open && <div className="searchable-select-popup">
      <ul id={`${id}-list`} role="listbox" aria-label={label}>
        {choices.map((option, index) => <li key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value} className={index === highlighted ? 'is-highlighted' : ''} ref={index === highlighted ? activeRef : undefined} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>{option.label}</li>)}
      </ul>
      {!choices.length && <p role="status">لا توجد نتائج مطابقة</p>}
      {choices.length > 0 && <small>{filtered.length} نتيجة · استخدم الأسهم ثم Enter أو اختر من القائمة</small>}
    </div>}
  </div>
}
