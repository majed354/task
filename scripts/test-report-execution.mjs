import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { executionContext, executionTicket } from '../netlify/functions/lib/reportExecution.ts'
const a='قسم القراءات',b='قسم الثقافة الإسلامية'
const row=(department,section,member)=>['٤٧٢','2002106','التجويد (2)',department,section,'غير مسلّم',0,0,0,0,6,0,'2026-10-06T20:00:00Z',member]
const link=(department,section)=>({term:'٤٧٢',code:'2002106',department,section,report:`1-التقارير/٤٧٢/QRA-القراءات/2002106-التجويد/الشعب/ش${section}/01-تقرير-المقرر`,measurement:`1-التقارير/٤٧٢/QRA-القراءات/2002106-التجويد/الشعب/ش${section}/02-قياس-مخرجات-تعلم-المقرر`,combined:'1-التقارير/٤٧٢/00-التقارير-المجمعة-للمقررات/2002106-التجويد',combinedMeasurement:'1-التقارير/٤٧٢/QRA-القراءات/2002106-التجويد/05-قياس-مخرجات-المقرر-المجمع'})
const snapshot={courseRows:[row(a,'001','عضو أول'),row(a,'002','عضو ثان')],folderLinks:[link(a,'001'),link(a,'002')]}
const body={term:'472',code:'2002106',department:a,section:'001',kind:'report'}
const first=executionContext(snapshot,a,body)
assert.equal(first.member,'عضو أول');assert.equal(first.term,'472');assert.equal(first.rows.length,1);assert.equal(first.folder,snapshot.folderLinks[0].report)
const second=executionContext(snapshot,a,{...body,kind:'measurement'})
assert.equal(second.folder,snapshot.folderLinks[0].measurement);assert.notEqual(first.folder,second.folder)
for(const kind of ['combined','combinedMeasurement']) {const ctx=executionContext(snapshot,a,{...body,kind});assert.equal(ctx.rows.length,2);assert.equal(ctx.folder,snapshot.folderLinks[0][kind]);assert.notEqual(ctx.destinations.report,ctx.destinations.measurement)}
assert.throws(()=>executionContext(snapshot,b,body),e=>e.status===403)
assert.throws(()=>executionContext(snapshot,a,{...body,term:'471'}),e=>e.status===403)
assert.throws(()=>executionContext(snapshot,a,{...body,section:'003'}),e=>e.status===403)
assert.throws(()=>executionContext(snapshot,a,{...body,folder:'anything'}),e=>e.status===422)
assert.throws(()=>executionContext(snapshot,a,{...body,kind:'audit'}),e=>e.status===422)
const cross={...snapshot,courseRows:[...snapshot.courseRows,row(b,'003','عضو آخر')],folderLinks:[...snapshot.folderLinks,link(b,'003')]}
assert.throws(()=>executionContext(cross,a,{...body,kind:'combined'}),e=>e.status===403)
assert.equal(executionContext(cross,'all',{...body,kind:'combined'}).rows.length,3)
const wrong={...snapshot,folderLinks:[{...snapshot.folderLinks[0],measurement:snapshot.folderLinks[0].report},snapshot.folderLinks[1]]}
assert.throws(()=>executionContext(wrong,a,{...body,kind:'measurement'}),e=>e.status===422)
const secret='a'.repeat(64),url=new URL(executionTicket(first,secret,123).url)
assert.equal(url.origin,'https://academic-reports-trial-20261006.netlify.app');assert.equal(url.search,'')
const [payload,signature]=url.hash.slice(11).split('.')
const claims=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'))
assert.equal(claims.exp-claims.iat,10800);assert.equal(claims.kind,'report');assert.equal(claims.member,'عضو أول')
assert.equal(signature,createHmac('sha256',secret).update(payload).digest('base64url'))
assert.throws(()=>executionTicket(first,''),e=>e.status===503)
console.log('Passed report execution: exact section/member/term, 4 destinations, scoped combined requests, signed fragment links.')
