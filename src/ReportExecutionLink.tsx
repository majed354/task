import { useState } from 'react'
import { FilePlus2 } from 'lucide-react'
import type { CourseDetailRow } from './courseReportData'

export default function ReportExecutionLink({ section, kind }: { section: CourseDetailRow; kind: 'report' | 'measurement' | 'combined' | 'combinedMeasurement' }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const measurement = kind === 'measurement' || kind === 'combinedMeasurement'
  async function execute() {
    // Open synchronously so mobile browsers keep this user-initiated navigation.
    const destination = window.open('about:blank', '_blank')
    if (destination) destination.opener = null
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/course/execute', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: section.term, code: section.code, department: section.department, section: section.section, kind }) })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error || 'تعذّر فتح خدمة التقارير.')
      const url = new URL(result.url)
      if (url.origin !== 'https://academic-reports-trial-20261006.netlify.app' || !url.hash.startsWith('#committee=')) throw new Error('رابط تنفيذ غير صالح.')
      if (destination) destination.location.replace(url.href)
      else window.location.assign(url.href)
    } catch (failure) {
      destination?.close(); setError(failure instanceof Error ? failure.message : 'تعذّر تنفيذ الطلب.')
    } finally { setBusy(false) }
  }
  return <><button type="button" className="report-execution-link" disabled={busy} onClick={execute} aria-label={`تنفيذ ${measurement ? 'قياس المخرجات' : 'تقرير المقرر'}: ${section.name}، الفصل ${section.term}، ${section.member}، الشعبة ${section.officialNumber?.officialSection || 'بحاجة للمطابقة'}`}><FilePlus2 size={15} />{busy ? 'جارٍ التوجيه…' : measurement ? 'تنفيذ القياس' : 'تنفيذ التقرير'}</button>{error && <small className="report-execution-error" role="alert">{error}</small>}</>
}
