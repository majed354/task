import { BrowserCacheLocation, PublicClientApplication } from '@azure/msal-browser'

export interface CommitteeRecord {
  id: string
  title: string
  department: string
  committee: string
  due: string
  status: string
  folderUrl: string
  additionalFolderItems: number | null
}

export interface CommitteeSnapshot {
  records: CommitteeRecord[]
  fetchedAt: Date
  foldersChecked: boolean
}

type GraphPage<T> = { value: T[]; '@odata.nextLink'?: string }
type GraphSite = { id: string }
type GraphList = { id: string; displayName?: string; name?: string }
type GraphColumn = { name: string; displayName?: string }
type GraphItem = { id: string; fields?: Record<string, unknown> }
type DriveItem = { id: string; name: string; folder?: { childCount?: number } }

const GRAPH = 'https://graph.microsoft.com/v1.0'
const SITE_PATH = '/sites/taifedusa.sharepoint.com:/sites/msteams_3b4354'
const LIST_NAME = 'سجل مهام اللجان 1448'
const GUIDE_PATH = 'أعمال اللجان/دليل مهام اللجان/٤٨١'
const SCOPE = 'Sites.Selected'

export const sharePointConfig = {
  clientId: import.meta.env.VITE_ENTRA_CLIENT_ID?.trim() ?? '',
  tenantId: import.meta.env.VITE_ENTRA_TENANT_ID?.trim() ?? '',
}

export const sharePointReady = Boolean(sharePointConfig.clientId && sharePointConfig.tenantId)

let clientPromise: Promise<PublicClientApplication> | null = null

async function client(): Promise<PublicClientApplication> {
  if (!sharePointReady) throw new Error('لم تُضبط هوية تطبيق Microsoft 365 لهذا الموقع.')
  if (!clientPromise) {
    clientPromise = (async () => {
      const instance = new PublicClientApplication({
        auth: {
          clientId: sharePointConfig.clientId,
          authority: `https://login.microsoftonline.com/${sharePointConfig.tenantId}`,
          redirectUri: `${window.location.origin}/`,
        },
        cache: { cacheLocation: BrowserCacheLocation.SessionStorage },
      })
      await instance.initialize()
      await instance.handleRedirectPromise()
      return instance
    })()
  }
  return clientPromise
}

export async function connectedAccount(): Promise<string | null> {
  if (!sharePointReady) return null
  const instance = await client()
  return instance.getAllAccounts()[0]?.username ?? null
}

export async function connectSharePoint(): Promise<void> {
  const instance = await client()
  await instance.loginRedirect({ scopes: [SCOPE], prompt: 'select_account' })
}

export async function disconnectSharePoint(): Promise<void> {
  const instance = await client()
  const account = instance.getAllAccounts()[0]
  if (account) await instance.logoutRedirect({ account })
}

async function accessToken(): Promise<string> {
  const instance = await client()
  const account = instance.getAllAccounts()[0]
  if (!account) throw new Error('يرجى تسجيل الدخول بحساب الجامعة لقراءة سجل اللجان.')
  try {
    const result = await instance.acquireTokenSilent({ scopes: [SCOPE], account })
    return result.accessToken
  } catch {
    await instance.acquireTokenRedirect({ scopes: [SCOPE], account })
    throw new Error('تجري إعادة توجيهك لإكمال تسجيل الدخول.')
  }
}

async function graph<T>(url: string, token: string): Promise<T> {
  if (!url.startsWith(`${GRAPH}/`)) throw new Error('عنوان بيانات غير صالح.')
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store',
  })
  if (response.status === 401 || response.status === 403) {
    throw new Error('تعذر الوصول إلى سجل اللجان. تحقق من عضويتك في موقع القادة وموافقة Microsoft 365 على القراءة.')
  }
  if (!response.ok) throw new Error(`تعذر قراءة بيانات SharePoint (${response.status}).`)
  return response.json() as Promise<T>
}

async function allPages<T>(url: string, token: string): Promise<T[]> {
  const result: T[] = []
  let next: string | undefined = url
  while (next) {
    const page: GraphPage<T> = await graph<GraphPage<T>>(next, token)
    result.push(...page.value)
    next = page['@odata.nextLink']
  }
  return result
}

function fieldName(columns: GraphColumn[], label: string): string | undefined {
  return columns.find((column) => column.displayName === label || column.name === label)?.name
}

function value(fields: Record<string, unknown>, name?: string): string {
  return name && fields[name] != null ? String(fields[name]).trim() : ''
}

function currentFolderUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.origin !== 'https://taifedusa.sharepoint.com') return value
    const decoded = decodeURIComponent(url.pathname)
    const marker = '/دليل مهام اللجان/'
    if (!decoded.includes(marker)) return value
    const relative = decoded.split(marker)[1].replace(/^٤٨١\//, '')
    const [department, ...rest] = relative.split('/')
    if (!department || rest.length < 2) return value
    // The department directories were uploaded from macOS with decomposed Arabic hamzas.
    const path = `/sites/msteams_3b4354/Shared Documents/أعمال اللجان/دليل مهام اللجان/٤٨١/${[department.normalize('NFD'), ...rest].join('/')}`
    return `${url.origin}/sites/msteams_3b4354/Shared%20Documents/Forms/AllItems.aspx?id=${encodeURIComponent(path)}`
  } catch { return value }
}

function folderKey(department: string, committee: string, task: string): string {
  return [department, committee, task].map((part) => part.normalize('NFKC').trim()).join('\u0000')
}

async function folderInventory(siteId: string, token: string): Promise<Map<string, number>> {
  const path = GUIDE_PATH.split('/').map(encodeURIComponent).join('/')
  const root = await graph<DriveItem>(`${GRAPH}/sites/${siteId}/drive/root:/${path}`, token)
  const byFolder = new Map<string, number>()
  const departments = (await allPages<DriveItem>(`${GRAPH}/sites/${siteId}/drive/items/${root.id}/children`, token))
    .filter((item) => item.folder && item.name.startsWith('قسم '))

  // Four department calls, then at most nine committee calls per department.
  for (const department of departments) {
    const committees = (await allPages<DriveItem>(`${GRAPH}/sites/${siteId}/drive/items/${department.id}/children`, token))
      .filter((item) => item.folder)
    for (const committee of committees) {
      const tasks = await allPages<DriveItem>(`${GRAPH}/sites/${siteId}/drive/items/${committee.id}/children`, token)
      for (const task of tasks) {
        if (!task.folder) continue
        // Every created task folder contains one guide file: «تفاصيل المهمة.md».
        byFolder.set(folderKey(department.name, committee.name, task.name), Math.max(0, (task.folder.childCount ?? 1) - 1))
      }
    }
  }
  return byFolder
}

export async function loadCommitteeSnapshot(): Promise<CommitteeSnapshot> {
  const token = await accessToken()
  const site = await graph<GraphSite>(`${GRAPH}${SITE_PATH}`, token)
  const lists = await allPages<GraphList>(`${GRAPH}/sites/${site.id}/lists`, token)
  const list = lists.find((item) => item.displayName === LIST_NAME || item.name === LIST_NAME)
  if (!list) throw new Error('لم يُعثر على «سجل مهام اللجان 1448» في موقع قادة الكلية.')

  const [columns, items] = await Promise.all([
    allPages<GraphColumn>(`${GRAPH}/sites/${site.id}/lists/${list.id}/columns`, token),
    allPages<GraphItem>(`${GRAPH}/sites/${site.id}/lists/${list.id}/items?$expand=fields&$top=200`, token),
  ])
  const names = {
    title: fieldName(columns, 'عنوان المهمة') ?? 'Title',
    id: fieldName(columns, 'معرف السجل'),
    department: fieldName(columns, 'القسم'),
    committee: fieldName(columns, 'اللجنة'),
    due: fieldName(columns, 'موعد التسليم'),
    status: fieldName(columns, 'الحالة'),
    folder: fieldName(columns, 'رابط مجلد المهمة'),
  }
  const records = items.map((item): CommitteeRecord => {
    const fields = item.fields ?? {}
    return {
      id: value(fields, names.id) || item.id,
      title: value(fields, names.title),
      department: value(fields, names.department),
      committee: value(fields, names.committee),
      due: value(fields, names.due).slice(0, 10),
      status: value(fields, names.status) || 'لم يبدأ',
      folderUrl: currentFolderUrl(value(fields, names.folder)),
      additionalFolderItems: null,
    }
  })

  let foldersChecked = false
  try {
    const inventory = await folderInventory(site.id, token)
    for (const record of records) {
      record.additionalFolderItems = inventory.get(folderKey(record.department, record.committee, record.title)) ?? null
    }
    foldersChecked = inventory.size > 0
  } catch {
    // List status remains available if Graph cannot enumerate the document library.
  }
  return { records, fetchedAt: new Date(), foldersChecked }
}
