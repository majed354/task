import assert from 'node:assert/strict'
import { memberBatchContext, memberBatchTicket } from '../netlify/functions/lib/reportExecution.ts'
import { createHmac } from 'node:crypto'
const d='قسم القراءات',row=(code,member,report='غير مسلّم',measurement=0)=>['٤٧١',code,'مقرر '+code,d,'001',report,measurement,0,0,0,4,0,'2026-10-07',member]
const links=code=>({term:'٤٧١',code,department:d,section:'001',report:`1-التقارير/٤٧١/QRA/مقرر${code}/الشعب/ش547/01-تقرير-المقرر`,measurement:`1-التقارير/٤٧١/QRA/مقرر${code}/الشعب/ش547/02-قياس-مخرجات-تعلم-المقرر`,combined:`1-التقارير/٤٧١/00-التقارير-المجمعة-للمقررات/${code}`,combinedMeasurement:`1-التقارير/٤٧١/QRA/${code}/05-قياس-مخرجات-المقرر-المجمع`})
const snapshot={courseRows:[row('2001','عضو'),row('2002','عضو','مستقل',0),row('2003','عضو','مستقل',1),row('2004','آخر')],folderLinks:[links('2001'),links('2002'),links('2003'),links('2004')]}
const body={terms:['471'],member:'عضو',department:d},batch=memberBatchContext(snapshot,d,body)
assert.equal(batch.items.length,3);assert.deepEqual(batch.items.map(i=>i.needs),[{report:true,measurement:true},{report:false,measurement:true},{report:false,measurement:false}])
assert.throws(()=>memberBatchContext(snapshot,'قسم الأنظمة',body),e=>e.status===403)
assert.throws(()=>memberBatchContext(snapshot,d,{...body,member:'غير موجود'}))
assert.throws(()=>memberBatchContext(snapshot,d,{...body,terms:['481']}))
assert.throws(()=>memberBatchContext(snapshot,d,{...body,destinations:{report:'anything'}}))
const missing={...snapshot,folderLinks:snapshot.folderLinks.filter(l=>l.code!=='2002')};assert.equal(memberBatchContext(missing,d,body).items.filter(i=>i.unavailable).length,1)
const duplicate={...snapshot,courseRows:[...snapshot.courseRows,snapshot.courseRows[0]]};assert.throws(()=>memberBatchContext(duplicate,d,body))
const secret='a'.repeat(64),url=new URL(memberBatchTicket(batch,secret).url);const [payload,sig]=url.hash.slice(11).split('.');const c=JSON.parse(Buffer.from(payload,'base64url'))
assert.equal(c.v,2);assert.equal(c.items.length,3);assert.equal(c.exp-c.iat,10800);assert.equal(sig,createHmac('sha256',secret).update(payload).digest('base64url'));assert.equal(url.search,'')
console.log('PASS member bundle: exact member/terms, scoped permissions, independent missing kinds, isolated invalid folders, duplicates rejected, signed fragment')
