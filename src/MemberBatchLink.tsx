import { useState } from 'react'
import { Layers, ArrowUpRight } from 'lucide-react'
import type { CourseDetailRow } from './courseReportData'

export default function MemberBatchLink({ member, terms, department, rows }: { member: string; terms: string[]; department: string; rows: CourseDetailRow[] }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const missing = rows.reduce((sum, row) => sum + Number(row.report === 'غير مسلّم') + Number(!row.measurement), 0)
  async function execute() {
    if (busy) return
    setBusy(true); setError('')
    const destination = window.open('about:blank', '_blank')
    if (destination) destination.opener = null
    try {
      const response = await fetch('/api/course/execute-member', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member, terms, department }) })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error || 'تعذر تجهيز الحزمة.')
      const url = new URL(result.url)
      if (url.origin !== 'https://academic-reports-trial-20261006.netlify.app' || !url.hash.startsWith('#committee=')) throw new Error('رابط غير صالح.')
      if (destination) destination.location.replace(url.href)
      else window.location.assign(url.href)
    } catch (failure) { destination?.close(); setError(failure instanceof Error ? failure.message : 'تعذر تجهيز الحزمة.') }
    finally { setBusy(false) }
  }
  return <section className="member-batch-launch" aria-label="إنجاز تقارير العضو">
    <div><strong><Layers size={20} /> إنجاز تقارير العضو</strong><p>{rows.length} شعبة · {missing} متطلبًا ناقصًا · التقرير وقياس المخرجات في مسار واحد</p><small>ستُجلب المجلدات المعتمدة الآن، وتظهر المقررات كلها قبل البدء. لا تُعاد المتطلبات المسلّمة، وتستمر المقررات الجاهزة عند تعثر أحدها.</small></div>
    <button className="report-execution-link" onClick={execute} disabled={busy || !missing}>{busy ? 'جارٍ تجهيز المقررات…' : missing ? 'إنجاز المتطلبات الناقصة' : 'جميع المتطلبات مسلّمة'}<ArrowUpRight size={18} /></button>
    {error && <p role="alert" className="report-execution-error">{error}</p>}
  </section>
}
