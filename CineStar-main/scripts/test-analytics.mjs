import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { analyticsPeriod, CHARTS } from '../lib/analytics-rules.js';
import { insightSnapshot, parseInsights, requestAnalyticsInsights } from '../lib/analytics-insights.js';
const base='http://localhost:5173',stamp=randomUUID(),fixture={users:[],bookings:[],show:randomUUID(),room:randomUUID()};let checks=0;
function check(value,label){assert.ok(value,label);checks++;console.log('OK '+label);}
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
function sql(text){const path=`.sites-runtime/analytics-${stamp}.sql`;writeFileSync(path,text);try{const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to','.wrangler/state','--config','.sites-runtime/db-init.json','--file',path,'--json'],{encoding:'utf8',windowsHide:true});if(result.status!==0)throw new Error(result.stderr||result.stdout);return JSON.parse(result.stdout).flatMap(r=>r.results||[]);}finally{unlinkSync(path);}}
async function call(path,method='GET',body,cookie=''){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
async function login(email,password='Demo@123'){const result=await call('/api/auth/login','POST',{email,password});assert.equal(result.status,200);return result.cookie;}
const params=value=>new URLSearchParams(value);
const leap=analyticsPeriod(params('year=2004&month=2'),Date.parse('2026-10-10T12:00:00Z'));
check(leap.start==='2004-01-31T17:00:00.000Z'&&leap.end==='2004-02-29T17:00:00.000Z','Leap month uses inclusive VN start and exclusive next-month start');
const january=analyticsPeriod(params('year=2026&month=1'),Date.parse('2026-02-01T00:00:00Z'));
check(january.previousStart==='2025-11-30T17:00:00.000Z','January compares with December of previous year');
const ongoing=analyticsPeriod(params('year=2026&month=10'),Date.parse('2026-10-10T05:00:00Z'));
check(Date.parse(ongoing.to)-Date.parse(ongoing.start)===Date.parse(ongoing.previousTo)-Date.parse(ongoing.previousStart),'Current month compares equal elapsed durations');
check(analyticsPeriod(params('year=2026&month=12'),Date.parse('2026-10-10T00:00:00Z')).future,'Future period marked explicitly');
for(const query of ['year=2003&month=2&day=29','year=2026&day=1','year=2026&month=13','year=abcd','year=2026&group=hour','year=2026&month=1&group=month','year=2026&revenue=100']){assert.throws(()=>analyticsPeriod(params(query)));checks++;}
try{
    const admin=await login('admin@cineverse.vn'),staff=await login('staff@cineverse.vn');
    const user=[];for(let i=0;i<2;i++){const result=await call('/api/auth/register','POST',{name:`Analytics ${i}`,email:`analytics-${stamp}-${i}@cineverse.test`,password:'AnalyticsQA@123',birthDate:'2000-01-15'});assert.equal(result.status,200);fixture.users.push(result.body.user.id);user.push({...result.body.user,cookie:result.cookie});}
    for(const cookie of ['',staff,user[0].cookie])for(const path of ['/api/admin/analytics','/api/admin/analytics/export','/api/admin/analytics/insights']){const response=await fetch(base+path,{method:path.endsWith('insights')?'POST':'GET',headers:{Cookie:cookie,'Content-Type':'application/json'},...(path.endsWith('insights')?{body:JSON.stringify({chart:'all'})}:{})});check(response.status===(cookie?403:401),'Analytics/export/AI are admin only');}
    const movie=(await call('/api/bootstrap')).body.movies[0].id;
    const staffId=(await call('/api/auth/me','GET',undefined,staff)).body.user.id;
    sql(`INSERT INTO rooms(id,name,rows,cols,type) VALUES(${quote(fixture.room)},'Analytics isolated room',2,4,'QA'); INSERT INTO showtimes(id,movie_id,room_id,start_time,price,format) VALUES(${quote(fixture.show)},${quote(movie)},${quote(fixture.room)},'2004-03-20T10:00:00.000Z',100000,'QA'); UPDATE users SET points=22,lifetime_points=330 WHERE id=${quote(user[1].id)};`);
    const samples=[
        [user[0].id,'2004-01-31T16:59:59.000Z',50000,1,'paid','momo'],
        [user[0].id,'2004-01-31T17:00:00.000Z',100000,2,'paid','momo'],
        [user[1].id,'2004-02-28T17:00:00.000Z',180000,3,'checked_in','bank'],
        [user[0].id,'2004-02-29T16:59:59.000Z',40000,1,'paid','card'],
        [user[0].id,'2004-02-29T17:00:00.000Z',70000,1,'paid','momo'],
        [user[0].id,'2004-02-14T01:00:00.000Z',999000,4,'cancelled','momo'],
        [user[0].id,'2004-02-20T01:00:00.000Z',0,1,'checked_in','momo'],
        [staffId,'2004-02-20T02:00:00.000Z',30000,1,'paid','bank'],
        [user[1].id,'2003-02-10T01:00:00.000Z',60000,1,'paid','bank'],
    ];
    sql(samples.map(([userId,date,total,seats,status,payment])=>{const id=randomUUID();fixture.bookings.push(id);return `INSERT INTO bookings(id,user_id,showtime_id,seats,combos,total,code,status,created_at,payment_method,points_earned) VALUES(${quote(id)},${quote(userId)},${quote(fixture.show)},${quote(JSON.stringify(Array.from({length:seats},(_,i)=>`A${i+1}`)))},'[]',${total},${quote('AQ'+id)},${quote(status)},${quote(date)},${quote(payment)},${status==='checked_in'?Math.floor(total/10000):0})`;}).join(';')+';');
    const report=(await call('/api/admin/analytics?year=2004&month=2','GET',undefined,admin)).body;
    check(report.totals.revenue===350000&&report.totals.tickets===8&&report.totals.orders===5,'Monthly revenue, seats and orders calculated from persisted bookings');
    check(report.totals.cancelled===1&&report.totals.allOrders===6,'Cancelled orders retained in status but excluded from revenue and tickets');
    check(report.previousTotals.revenue===50000,'Month compares previous month, excluding next-month boundary');
    check(report.timeline.filter(row=>!row.key.startsWith('previous:')).length===29&&report.timeline[0].revenue===100000&&report.timeline[28].revenue===220000,'Daily series includes zeros, leap day and Vietnam boundary');
    check(report.timeline.reduce((sum,row)=>sum+row.previousRevenue,0)===report.previousTotals.revenue,'Shorter months retain all previous-month revenue including extra days');
    check(report.movies[0].revenue===350000&&report.movies[0].tickets===8,'Movie ranking matches net report totals');
    check(report.payments.reduce((n,r)=>n+r.revenue,0)===350000&&report.payments.find(r=>r.key==='bank').revenue===210000,'Payment distribution sums to net revenue');
    check(report.weekdays.reduce((n,r)=>n+r.tickets,0)===8,'Weekday chart sums to valid seats');
    check(report.members.length===2&&report.members[0].id===user[1].id&&report.members[0].spending===180000&&report.members[0].earned===18,'Member ranking ordered by period spending and excludes staff orders');
    check(report.members[0].tier==='Vàng'&&report.members[0].points===22,'Current loyalty tier/balance shown separately from period points');
    const daily=(await call('/api/admin/analytics?year=2004&month=2&day=29','GET',undefined,admin)).body;
    check(daily.timeline.length===24&&daily.timeline[0].revenue===180000&&daily.timeline[23].revenue===40000&&daily.totals.revenue===220000,'Day filter uses hourly grouping and exact local boundaries');
    const annual=(await call('/api/admin/analytics?year=2004','GET',undefined,admin)).body;
    check(annual.totals.revenue===470000&&annual.timeline.length===12&&annual.timeline[1].revenue===350000,'Annual view includes only selected year and groups into months');
    const days=(await call('/api/admin/analytics?year=2004&group=day','GET',undefined,admin)).body;
    check(days.timeline.length===366&&days.timeline.reduce((n,r)=>n+r.revenue,0)===470000,'Year can be grouped by day including leap year');
    const empty=(await call('/api/admin/analytics?year=2002','GET',undefined,admin)).body;
    check(empty.totals.revenue===0&&empty.members.length===0&&empty.comparisons.revenue.percent===null,'Empty reports use zero totals and no fabricated percentages');
    for(const method of ['POST','PATCH','DELETE']){const result=await fetch(base+'/api/admin/analytics?year=2004',{method,headers:{Cookie:admin,'Content-Type':'application/json'},body:JSON.stringify({revenue:1,tickets:1})});check([404,405].includes(result.status),'Report does not allow direct '+method+' mutation');}
    check((await call(`/api/bookings/${fixture.bookings[1]}`,'PATCH',{action:'checkin',total:1,seats:['A1']},admin)).status===400,'Even admin cannot patch booking money or seat totals');
    check((await call('/api/admin/analytics?year=2004&month=2','GET',undefined,admin)).body.totals.revenue===350000,'Rejected edits leave report intact');
    check((await call('/api/admin/analytics?year=2004&month=2&day=30','GET',undefined,admin)).status===400,'Invalid report dates return validation errors');
    check((await call('/api/admin/analytics/insights?year=2004&month=2','POST',{chart:'revenue',revenue:999999},admin)).status===400,'AI endpoint rejects client-supplied financial facts');
    const snapshot=insightSnapshot(report),serialized=JSON.stringify(snapshot);
    check(!serialized.includes(user[0].id)&&!serialized.includes(user[0].name)&&!serialized.includes('email')&&!serialized.includes('birthDate')&&!serialized.includes('cardNumber'),'Gemini payload excludes member identities and credentials');
    const result=Object.fromEntries(Object.keys(CHARTS).map(key=>[key,{observation:'Số liệu cho thấy cần đối chiếu kỹ giữa các kỳ.',suggestion:'Nên kiểm tra thêm lịch chiếu trước khi ra quyết định.'}]));
    check(Object.keys(parseInsights(result,Object.keys(CHARTS))).length===7,'Structured insights accepted for every chart');
    assert.throws(()=>parseInsights({revenue:{observation:'Doanh thu tăng 900%.',suggestion:'Hãy điều chỉnh ngay giá vé.'}},['revenue']));checks++;
    let captured;
    const mocked=await requestAnalyticsInsights(snapshot,['revenue'],{key:'test-key',model:'test-model',fetcher:async(url,options)=>{captured=JSON.parse(options.body);return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({revenue:result.revenue})}]}}]})};}});
    check(mocked.revenue.observation===result.revenue.observation&&JSON.parse(captured.contents[0].parts[0].text).charts.revenue.comparison.current===350000,'Gemini receives trusted computed facts and response is validated');
    await assert.rejects(()=>requestAnalyticsInsights(snapshot,['revenue'],{key:'test',model:'test',fetcher:async()=>({ok:false})}));checks++;
    const excel=await fetch(base+'/api/admin/analytics/export?year=2004&month=2',{headers:{Cookie:admin}});
    check(excel.ok&&excel.headers.get('content-type').includes('spreadsheetml'),'Export returns a genuine XLSX content type');
    const bytes=new Uint8Array(await excel.arrayBuffer());writeFileSync('.sites-runtime/analytics-test.xlsx',bytes);
    check(bytes[0]===0x50&&bytes[1]===0x4b,'XLSX is an OOXML ZIP archive');
    const text=new TextDecoder().decode(bytes);check(text.includes('xl/worksheets/sheet7.xml')&&text.includes('<v>350000</v>')&&text.includes('2004-02-29'),'Workbook includes all seven sheets and exact filtered numeric data');
    await call(`/api/admin/users/${user[0].id}`,'DELETE',undefined,admin);
    const after=(await call('/api/admin/analytics?year=2004&month=2','GET',undefined,admin)).body;
    check(after.totals.revenue===350000&&after.members.length===1,'Deleted member keeps historical revenue but leaves active member ranking');
    console.log(`\n${checks} analytics assertions passed.`);
}finally{const users=fixture.users.map(quote).join(',')||"''",bookings=fixture.bookings.map(quote).join(',')||"''";sql(`DELETE FROM bookings WHERE id IN (${bookings}); DELETE FROM sessions WHERE user_id IN (${users}); DELETE FROM users WHERE id IN (${users}); DELETE FROM showtimes WHERE id=${quote(fixture.show)}; DELETE FROM rooms WHERE id=${quote(fixture.room)};`);console.log('Analytics fixtures cleaned.');}
