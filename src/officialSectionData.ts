export interface OfficialSectionData {
  term: string
  code: string
  department: string
  section: string // Stable folder reference; never replaced by the official number.
  member: string
  officialSection: string
  status: 'matched' | 'ambiguous' | 'missing'
  candidates: string[]
  sourceFiles: string[]
}

export const officialSectionKey = (row: Pick<OfficialSectionData, 'term' | 'code' | 'department' | 'section'>) => [row.term, row.code, row.department, row.section].join(':')

export function validOfficialSections(value: unknown, courseRows: Array<Array<string | number>>): value is OfficialSectionData[] {
  if (!Array.isArray(value) || value.length !== courseRows.length) return false
  const expected = new Map(courseRows.map(row => [[row[0], row[1], row[3], row[4]].join(':'), String(row[13])]))
  const seen = new Set<string>()
  const assigned = new Set<string>()
  for (const row of value) {
    if (!row || typeof row !== 'object' || !['term', 'code', 'department', 'section', 'member', 'officialSection'].every(field => typeof row[field] === 'string')) return false
    const key = officialSectionKey(row)
    if (expected.get(key) !== row.member || seen.has(key) || !['matched', 'ambiguous', 'missing'].includes(row.status)) return false
    if (!Array.isArray(row.candidates) || row.candidates.some((number: unknown) => typeof number !== 'string' || !/^\d+$/.test(number)) || new Set(row.candidates).size !== row.candidates.length) return false
    if (!Array.isArray(row.sourceFiles) || row.sourceFiles.some((name: unknown) => typeof name !== 'string' || !name.trim() || /[\\/]/.test(name))) return false
    if (row.status === 'matched') {
      const physicalKey = `${row.term}:${row.code}:${row.officialSection}`
      if (!/^\d+$/.test(row.officialSection) || !row.candidates.includes(row.officialSection) || !row.sourceFiles.length || assigned.has(physicalKey)) return false
      assigned.add(physicalKey)
    } else if (row.officialSection !== '' || row.sourceFiles.length) return false
    seen.add(key)
  }
  return true
}
