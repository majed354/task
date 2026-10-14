import assert from 'node:assert/strict'
import { matchesArabicSearch, normalizeArabicSearch } from '../src/arabicSearch.ts'

const matching = [
  ['عائشة جبريل مكي علي', 'عائشه'],
  ['عبدالله منصور', 'عبد الله'],
  ['عبد الله منصور', 'عبدالله'],
  ['أحمد محمد الأزوري', 'احمد محمد الازوري'],
  ['إبراهيم مهنا', 'ابراهيم'],
  ['الثقافة الإسلامية', 'الثقافه الاسلاميه'],
  ['عائشة', 'عايشه'],
  ['مصطفى', 'مصطفي'],
  ['مؤمن', 'مومن'],
  ['عَبْدُ الرَّحْمَٰن', 'عبدالرحمن'],
  ['عبد\u200f الله', 'عبدالله'],
  ['عبد-الله', 'عبد الله'],
  ['العقود التجارية · 2003433', '٢٠٠٣٤٣٣'],
  ['التجويد (٢)', 'التجويد2'],
  ['عائشه جبريل مكي علي', 'عائشةجبريل'],
  ['قراءات · 2002308', '۲۰۰۲۳۰۸'],
  ['د.ماجد ابراهيم باقي الجهني', 'ماجد الجهني'],
  ['د.ماجد ابراهيم باقي الجهني', 'ماجد باقي'],
]
for (const [name, query] of matching) assert.ok(matchesArabicSearch(name, query), `${name} should match ${query}`)
for (const [name, query] of [['عبدالله', 'عبيدالله'], ['عائشة', 'فاطمة'], ['التفسير', 'الفقه'], ['2003433', '2003434']]) assert.equal(matchesArabicSearch(name, query), false)
assert.equal(normalizeArabicSearch('عائشة عبد الله'), normalizeArabicSearch('عايشه عبدالله'))
const names = ['عبدالله منصور', 'عبد الله سعد', 'عبد الرحمن بن عبدالله', 'عبد الرحمن اللهيبي', 'عائشة جبريل']
assert.deepEqual(names.filter((name) => matchesArabicSearch(name, 'عبدالله')), names.filter((name) => matchesArabicSearch(name, 'عبد الله')))
assert.ok(matchesArabicSearch('أي مقرر', ''))
assert.equal(matchesArabicSearch('د.محمد ماجد إبراهيم', 'ماجد الجهني'), false)
assert.equal(matchesArabicSearch('د.ماجد ابراهيم باقي الجهني', 'الجهني ماجد'), false)
console.log('Arabic search: letter variants, diacritics, spacing, multi-part names and course numbers passed.')
