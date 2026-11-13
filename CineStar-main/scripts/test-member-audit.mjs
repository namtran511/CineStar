import assert from 'node:assert/strict';import{randomUUID}from'node:crypto';import{spawnSync}from'node:child_process';import{writeFileSync,unlinkSync}from'node:fs';
const base='http://localhost:5173',stamp=randomUUID(),fixtures={users:[],combo:''};let checks=0;
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
function check(value,label){assert.ok(value,label);checks++;console.log('OK '+label);}
function sql(source,allowFailure=false){const path=`.sites-runtime/audit-qa-${stamp}.sql`;writeFileSync(path,source);try{const r=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to','.wrangler/state','--config','.sites-runtime/db-init.json','--file',path,'--json'],{encoding:'utf8',windowsHide:true});if(allowFailure)return r;assert.equal(r.status,0,r.stderr||r.stdout);return JSON.parse(r.stdout).flatMap(item=>item.results||[]);}finally{unlinkSync(path);}}
async function call(path,method='GET',body,cookie=''){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function login(email){const r=await call('/api/auth/login','POST',{email,password:'Demo@123'});assert.equal(r.status,200,JSON.stringify(r.body));return {cookie:r.cookie,...r.body.user};}
async function logs(id,admin,entity='users'){const result=await call(`/api/admin/audit?entity=${entity}&entity_id=${encodeURIComponent(id)}`,'GET',undefined,admin.cookie);assert.equal(result.status,200);return result.body.logs;}
try{
 const admin=await login('admin@cineverse.vn'),staff=await login('staff@cineverse.vn');
 const registration=await call('/api/auth/register','POST',{name:'QA audit temporary member',email:`audit-${stamp}@cineverse.test`,password:'AuditTest@123',birthDate:'2000-01-15'});assert.equal(registration.status,200,JSON.stringify(registration.body));const member={cookie:registration.cookie,...registration.body.user};fixtures.users.push(member.id);
 for(const cookie of ['',member.cookie,staff.cookie])check((await call('/api/admin/audit','GET',undefined,cookie)).status===(cookie?403:401),'Audit log is admin-only');
 for(const cookie of ['',member.cookie])check((await call('/api/staff/members?q=audit','GET',undefined,cookie)).status===(cookie?403:401),'Customer lookup requires staff/admin');
 const found=await call(`/api/staff/members?q=${encodeURIComponent(member.email)}`,'GET',undefined,staff.cookie);check(found.body.members.length===1&&found.body.members[0].id===member.id,'Staff finds customer by email');
 check(!JSON.stringify(found.body).includes('password')&&!JSON.stringify(found.body).includes('lifetime'),'Staff lookup exposes only necessary customer fields');
 const path=`/api/staff/members/${member.id}/birthday`,body={birthDate:'2000-02-29',expectedBirthDate:'2000-01-15',reason:'QA corrected birthday after checking customer'};
 check((await call(path,'PATCH',body,member.cookie)).status===403,'Member cannot use staff birthday endpoint');
 for(const bad of [{...body,birthDate:'2001-02-29'},{...body,birthDate:'2999-01-01'},{...body,reason:''},{...body,role:'admin'},{...body,points:100}])check((await call(path,'PATCH',bad,staff.cookie)).status===400,'Reject invalid date, missing reason or forged fields');
 check((await call(path,'PATCH',body,staff.cookie)).status===200,'Staff changes customer birthday');
 const firstLogs=await logs(member.id,admin),dobLog=firstLogs.find(row=>row.after?.birth_date==='2000-02-29');
 check(dobLog?.actor_id===staff.id&&dobLog.actor_role==='staff'&&dobLog.before.birth_date==='2000-01-15'&&dobLog.reason===body.reason,'Birthday audit captures actor, old/new values and reason');
 check((await call(path,'PATCH',body,staff.cookie)).status===409,'Stale birthday edit cannot overwrite a newer value');
 const race=await Promise.all([staff,admin].map((actor,i)=>call(path,'PATCH',{birthDate:`2000-03-0${i+1}`,expectedBirthDate:'2000-02-29',reason:`QA parallel birthday ${i}`},actor.cookie)));
 check(race.filter(r=>r.status===200).length===1&&race.filter(r=>r.status===409).length===1,'Concurrent birthday changes accept one expected value');
 const raceLogs=await logs(member.id,admin);check(raceLogs.filter(r=>r.reason.startsWith('QA parallel')).length===1,'Rejected race creates no false change log');
 const accepted=race.findIndex(r=>r.status===200);check(raceLogs.find(r=>r.reason.startsWith('QA parallel')).actor_id===[staff,admin][accepted].id,'Concurrent requests keep the correct audit identity');
 check((await call(`/api/staff/members/${staff.id}/birthday`,'PATCH',{...body,expectedBirthDate:null},staff.cookie)).status===409,'Staff cannot edit a staff/admin profile through customer endpoint');
 const grantPath=`/api/admin/users/${member.id}/points`,grant={points:100,reason:'QA loyalty goodwill bonus',requestId:randomUUID()};
 for(const actor of [staff,member])check((await call(grantPath,'POST',grant,actor.cookie)).status===403,'Only admin can grant points');
 for(const invalid of [{...grant,points:-1},{...grant,points:1.5},{...grant,points:1000001},{...grant,reason:''},{...grant,lifetimePoints:500}])check((await call(grantPath,'POST',invalid,admin.cookie)).status===400,'Invalid bonus request rejected');
 const bonuses=await Promise.all([1,2].map(()=>call(grantPath,'POST',grant,admin.cookie)));check(bonuses.every(r=>r.status===200),'Retrying concurrent identical bonus is idempotent');
 let profile=(await call('/api/membership/me','GET',undefined,member.cookie)).body.membership;
 check(profile.points===100&&profile.lifetimePoints===0&&profile.transactions.filter(r=>r.description.includes('QA loyalty')).length===1,'Bonus is credited once, visible in ledger, and does not inflate tier');
 const pointLogs=await logs(member.id,admin);const bonusLog=pointLogs.find(r=>r.after?.points===100);check(bonusLog?.actor_id===admin.id&&bonusLog.before.points===0&&bonusLog.reason===grant.reason,'Point audit records exact balance change and administrator');
 check(pointLogs.filter(r=>r.after?.points===100).length===1,'Duplicate request produces no duplicate audit change');
 check((await call(grantPath,'POST',{...grant,points:200},admin.cookie)).status===409,'Idempotency key cannot be reused with a different amount');
 const different=await Promise.all([20,30].map(points=>call(grantPath,'POST',{points,reason:'QA independent parallel bonus',requestId:randomUUID()},admin.cookie)));check(different.every(r=>r.status===200)&&(await call('/api/membership/me','GET',undefined,member.cookie)).body.membership.points===150,'Distinct concurrent bonuses add without lost balance updates');
 const combo=await call('/api/admin/combos','POST',{name:`QA audit combo ${stamp}`,description:'Temporary audit coverage fixture',price:10000,image:'/images/combo-solo.svg'},admin.cookie);assert.equal(combo.status,201);fixtures.combo=combo.body.combo.id;
 await call(`/api/admin/combos/${fixtures.combo}`,'PATCH',{price:12000},admin.cookie);await call(`/api/admin/combos/${fixtures.combo}`,'DELETE',undefined,admin.cookie);
 const comboLogs=await logs(fixtures.combo,admin,'combos');check(['insert','update','delete'].every(action=>comboLogs.some(r=>r.action===action&&r.actor_id===admin.id)),'Catalog create/update/delete also recorded automatically');
 check(comboLogs.find(r=>r.action==='update').before.price===10000&&comboLogs.find(r=>r.action==='update').after.price===12000,'Catalog price log contains both values');
 const logText=JSON.stringify(await logs(member.id,admin));check(!logText.includes('AuditTest@123')&&!logText.includes('password_hash')&&!logText.includes('cineverse_session'),'Audit never stores passwords, hashes or session tokens');
 const immutableId=dobLog.id;
 for(const statement of [`UPDATE audit_logs SET reason='tampered' WHERE id=${immutableId}`,`DELETE FROM audit_logs WHERE id=${immutableId}`,`INSERT OR REPLACE INTO audit_logs SELECT * FROM audit_logs WHERE id=${immutableId}`]){const result=sql(statement,true);check(result.status!==0&&/immutable/i.test(result.stderr+result.stdout),'Database rejects mutation or replacement of an existing audit record');}
 for(const method of ['POST','PATCH','DELETE']){const response=await fetch(base+'/api/admin/audit',{method,headers:{Cookie:admin,'Content-Type':'application/json'},body:JSON.stringify({id:immutableId})});check([404,405].includes(response.status),'No '+method+' API for audit logs');}
 check(sql('SELECT COUNT(*) count FROM audit_context')[0].count===0,'Request context does not leak after completed writes');
 await call(`/api/admin/users/${member.id}`,'DELETE',undefined,admin.cookie);check((await logs(member.id,admin)).some(row=>row.after?.deleted_at&&row.actor_id===admin.id),'Account deletion is logged and historical logs remain');
 console.log(`\n${checks} member operations and immutable audit checks passed.`);
}finally{const users=fixtures.users.map(quote).join(',')||"''";sql(`DELETE FROM membership_transactions WHERE user_id IN (${users}); DELETE FROM sessions WHERE user_id IN (${users}); DELETE FROM users WHERE id IN (${users});`);console.log('Temporary QA accounts removed; immutable QA audit records intentionally retained.');}
