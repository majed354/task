/** Search normalization only; original names and record keys stay unchanged. */
export function normalizeArabicSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/\p{M}/gu, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئی]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ک/g, 'ك')
    .replace(/[\s\p{P}\p{S}\u0640\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu, '')
}

export function matchesArabicSearch(value: string, query: string): boolean {
  const normalized = normalizeArabicSearch(value)
  if (normalized.includes(normalizeArabicSearch(query))) return true
  const parts = query.normalize('NFKC').replace(/\p{M}/gu, '').replace(/عبد\s+/g, 'عبد')
    .split(/\s+/u).map(normalizeArabicSearch).filter(Boolean)
  let after = 0
  return parts.every((part) => {
    const position = normalized.indexOf(part, after)
    if (position < 0) return false
    after = position + part.length
    return true
  })
}
