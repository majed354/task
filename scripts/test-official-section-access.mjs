import assert from 'node:assert/strict'
import { validOfficialSections } from '../src/officialSectionData.ts'
import { scopedSnapshot } from '../netlify/functions/course.ts'
const row = (department, section, member) => ['٤٧٢', '2003433', 'العقود', department, section, 'غير مسلّم', 0, 0, 0, 0, 6, 0, '2026-10-07T00:00:00Z', member]
const a = 'قسم الأنظمة', b = 'قسم الشريعة'
const rows = [row(a, '001', 'عضو أول'), row(b, '002', 'عضو ثان')]
const number = (department, section, member, officialSection) => ({ term: '٤٧٢', code: '2003433', department, section, member, officialSection, status: 'matched', candidates: [officialSection], sourceFiles: ['472.xls'] })
const numbers = [number(a, '001', 'عضو أول', '4367'), number(b, '002', 'عضو ثان', '994')]
assert.ok(validOfficialSections(numbers, rows))
const snapshot = { aggregateRows: [['٤٧٢', a], ['٤٧٢', b]], courseRows: rows, sectionNumbers: numbers }
const own = scopedSnapshot(snapshot, a)
assert.equal(own.sectionNumbers.length, 1)
assert.equal(own.sectionNumbers[0].officialSection, '4367')
assert.ok(validOfficialSections(own.sectionNumbers, own.courseRows))
assert.equal(scopedSnapshot(snapshot, 'all').sectionNumbers.length, 2)
assert.equal(validOfficialSections([numbers[0], { ...numbers[1], officialSection: '4367', candidates: ['4367'] }], rows), false)
assert.equal(validOfficialSections([numbers[0], { ...numbers[1], member: 'عضو أول' }], rows), false)
assert.equal(validOfficialSections([numbers[0]], rows), false)
assert.equal(validOfficialSections([numbers[0], { ...numbers[1], status: 'ambiguous' }], rows), false)
assert.ok(validOfficialSections([numbers[0], { ...numbers[1], officialSection: '', status: 'ambiguous', sourceFiles: [] }], rows))
assert.deepEqual(snapshot.courseRows, rows)
console.log('Official section numbers: validated identity, uniqueness, unresolved cases and department isolation.')
