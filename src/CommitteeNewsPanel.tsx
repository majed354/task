import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock3, FolderOpen, Newspaper, PlusCircle } from 'lucide-react'
import { committeeNewsForView, committeeNewsLabel, type CommitteeNewsItem } from './committeeNews'
import type { CommitteeTask } from './committeeTaskData'

const observedDate = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' })

export default function CommitteeNews({ news, records, unavailable = false }: { news: CommitteeNewsItem[]; records: CommitteeTask[]; unavailable?: boolean }) {
  const [visible, setVisible] = useState(6)
  const items = useMemo(() => committeeNewsForView(news, records), [news, records])
  const tasks = useMemo(() => new Map(records.map((task) => [`${task.term}:${task.id}`, task])), [records])
  useEffect(() => { setVisible(6) }, [records])
  return <section className="monitor-panel committee-news" aria-labelledby="committee-news-title">
    <div className="monitor-panel-head"><h2 id="committee-news-title"><Newspaper size={20} /> آخر الأخبار</h2><span>أخبار النطاق المختار</span></div>
    <p className="committee-news-intro">إضافات المهام وإنجازاتها، وطلبات مراجعة المستندات ونتائجها، بحسب النطاق المختار.</p>
    {unavailable ? <p className="monitor-error" role="alert">تعذّر تحميل الأخبار. اضغط «تحديث البيانات» للمحاولة مجددًا.</p> : <>
      {items.length ? <ol className="committee-news-list">{items.slice(0, visible).map((item) => {
        const task = tasks.get(`${item.term}:${item.taskId}`)!
        const completed = item.kind === 'completed' || item.kind === 'recorded'
        const Icon = completed ? CheckCircle2 : item.kind === 'added' ? PlusCircle : Clock3
        return <li key={item.id} className={`committee-news-item${completed ? ' is-completed' : ''}`}>
          <span className="committee-news-icon"><Icon size={21} aria-hidden="true" /></span>
          <div className="committee-news-body"><span className="committee-news-kind">{committeeNewsLabel(item)}</span><h3>{item.title}</h3>
            <p>{item.department} · {item.committee}</p>
            {item.observedAt ? <time dateTime={item.observedAt}>رُصد التحديث: {observedDate.format(new Date(item.observedAt))}</time> : <small>مسجل في الحالة الحالية؛ تاريخ الإنجاز غير متاح.</small>}
          </div>
          <a href={task.folderUrl} target="_blank" rel="noreferrer" className="committee-news-folder" aria-label={`فتح مجلد المهمة: ${item.title}`}><FolderOpen size={17} /> {item.kind === 'review' ? 'قراءة المراجعة في المجلد' : 'مجلد المهمة'}</a>
        </li>
      })}</ol> : <p className="committee-empty" role="status">لا توجد أخبار مسجلة لهذا النطاق بعد. ستظهر هنا الإضافات وتغييرات الحالة بعد المزامنة.</p>}
      {visible < items.length && <button type="button" className="course-more" onClick={() => setVisible((count) => count + 6)}>عرض أخبار أكثر</button>}
      <p className="monitor-note">وقت الخبر هو وقت رصد التغيير في السجل. رفع ملف وحده لا يعني اكتمال المهمة أو اعتمادها.</p>
    </>}
  </section>
}
