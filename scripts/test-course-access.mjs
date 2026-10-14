import assert from 'node:assert/strict'
import { normalizePassword, scopedSnapshot } from '../netlify/functions/course.ts'
import { courseFolderUrl, isCourseFolderPath } from '../src/courseFolderLinks.ts'

const sharia = 'قسم الشريعة'
const systems = 'قسم الأنظمة'
const report = (department, section, delivered) => ['٤٧٢', '2001001', 'مقرر مشترك', department, section, delivered ? 'مستقل' : 'غير مسلّم', 0, 0, 0, 1, 8, 0, '2026-09-24T10:00:00Z', `عضو ${department}`]
const snapshot = {
  aggregateRows: [['٤٧٢', sharia, 2], ['٤٧٢', systems, 1]],
  courseRows: [report(sharia, '001', true), report(sharia, '002', false), report(systems, '003', false)],
  folderLinks: [{ department: sharia, section: '001', report: '1-التقارير/٤٧٢/SHR-الشريعة/2001001-مقرر/الشعب/ش001-عضو/01-تقرير-المقرر' }, { department: systems, section: '003', report: '1-التقارير/٤٧٢/LAW-الأنظمة/2001001-مقرر/الشعب/ش003-عضو/01-تقرير-المقرر' }],
}

const own = scopedSnapshot(snapshot, sharia)
assert.equal(own.aggregateRows.length, 1)
assert.equal(own.courseRows.length, 2)
assert.ok(own.courseRows.every((row) => row[3] === sharia && !String(row[13]).includes(systems)))
assert.ok(own.courseRows.every((row) => row[9] === 1 && row[10] === 6))
assert.equal(own.folderLinks.length, 1)
assert.ok(own.folderLinks.every((row) => row.department === sharia && !row.report.includes('LAW-الأنظمة')))

const other = scopedSnapshot(snapshot, systems)
assert.equal(other.courseRows.length, 1)
assert.equal(other.courseRows[0][9], 0)
assert.equal(other.courseRows[0][10], 2)
assert.equal(scopedSnapshot(snapshot, 'all').courseRows.length, 3)
assert.equal(scopedSnapshot(snapshot, 'all').folderLinks.length, 2)
assert.equal(scopedSnapshot({ ...snapshot, folderLinks: undefined }, systems).folderLinks, undefined)
assert.equal(isCourseFolderPath('https://example.com/upload'), false)
assert.equal(isCourseFolderPath('1-التقارير/٤٧٢/../2-المتابعة'), false)
assert.equal(isCourseFolderPath('1-التقارير/٤٧٢/LAW\\..\\private'), false)
assert.equal(isCourseFolderPath('1-التقارير/٤٨١/LAW-الأنظمة'), false)
const folderUrl = new URL(courseFolderUrl(snapshot.folderLinks[0].report))
assert.equal(folderUrl.origin, 'https://taifedusa.sharepoint.com')
assert.equal(folderUrl.searchParams.get('id'), '/sites/msteams_3b4354/Shared Documents/متابعة تقارير المقررات/' + snapshot.folderLinks[0].report)
assert.equal(snapshot.courseRows[0][10], 8, 'Filtering must not modify the stored source')
assert.equal(normalizePassword('m٤٨٢٧'), 'M4827')
assert.equal(normalizePassword('m۴۸۲۷'), 'M4827')
assert.equal(normalizePassword('M4827'), 'M4827')

console.log('نجح اختبار عزل بيانات الأقسام وإعادة احتساب المقرر المشترك.')
