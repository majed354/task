import { FolderUp } from 'lucide-react'
import { courseFolderUrl } from './courseFolderLinks'

export default function ReportFolderLink({ path, delivered, label }: { path?: string; delivered: boolean; label: string }) {
  const url = path && courseFolderUrl(path)
  if (!url) return <small className="report-folder-unavailable">رابط المجلد بانتظار التحديث</small>
  return <a className={`report-folder-link${delivered ? ' is-delivered' : ''}`} href={url} target="_blank" rel="noopener noreferrer" aria-label={`${delivered ? 'فتح مجلد' : 'رفع'} ${label}`}><FolderUp size={15} />{delivered ? 'فتح المجلد' : 'رفع الملف'}</a>
}
