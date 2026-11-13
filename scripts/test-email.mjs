import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { requestEmailCode, confirmEmailCode, resendEmailCode } from '../lib/server/email-verification.js';
import { emailConfiguration, emailPayload } from '../lib/server/email-delivery.js';
import { runEmailJobs, enqueueBirthdays } from '../lib/server/email-jobs.js';
import { hashPassword, verifyPassword } from '../lib/server/password.js';

// Every database and recipient is isolated; all external email HTTP calls are mocked.
const env={RESEND_API_KEY:'test-key',EMAIL_FROM:'CineStar <test@example.test>',EMAIL_CODE_SECRET:'test-only-secret-with-at-least-32-characters',APP_URL:'https://cinema.example.test',APP_ENV:'production'};
const now=Date.now();
let checks=0;
function check(value,label){assert.ok(value,label);checks++;console.log('PASS '+label);}
function database(){
    const sqlite=new DatabaseSync(':memory:');
    for(const file of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort()) sqlite.exec(readFileSync(`drizzle/${file}`,'utf8'));
    const wrap=(sql,args=[])=>({
        bind(...values){return wrap(sql,values);},
        async first(){return sqlite.prepare(sql).get(...args)||null;},
        async all(){return {results:sqlite.prepare(sql).all(...args)};},
        execute(){const result=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};},
        async run(){return this.execute();},
    });
    return {sqlite,prepare:sql=>wrap(sql),async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(statement=>statement.execute());sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}}};
}
const capture=()=>{const messages=[];return {messages,async fetcher(url,options){assert.equal(url,'https://api.resend.com/emails');messages.push({payload:JSON.parse(options.body),key:options.headers['Idempotency-Key']});return Response.json({id:crypto.randomUUID()});}};};
const codeOf=mail=>mail.payload.text.match(/Mã xác minh của bạn: (\d{6})/)[1];
const details={purpose:'register',name:'Khách <script>test</script>',email:'customer@example.test',passwordHash:await hashPassword('OnlyTest@123'),birthDate:'2000-01-15',marketing:true,birthday:true};

check(!emailConfiguration({}).configured,'missing configuration fails closed');
check(!emailConfiguration({...env,APP_URL:'http://public.example.test'}).configured,'production email links require HTTPS');
const db=database(),mail=capture();
const challenge=await requestEmailCode(db,env,details,{now,fetcher:mail.fetcher});
check(!await db.prepare('SELECT id FROM users WHERE email=?').bind(details.email).first(),'no user exists before email verification');
check(!JSON.stringify(challenge).includes(codeOf(mail.messages[0])),'OTP is absent from API response');
const pending=await db.prepare('SELECT * FROM email_challenges WHERE id=?').bind(challenge.challengeId).first();
check(pending.code_hash!==codeOf(mail.messages[0])&&pending.code_hash.length===64,'only keyed OTP hash is persisted');
check(!mail.messages[0].payload.html.includes('<script>'),'email HTML escapes customer input');
await assert.rejects(()=>resendEmailCode(db,env,challenge.challengeId,{now:now+1000,fetcher:mail.fetcher}),error=>error.status===429);checks++;
const renewed=await resendEmailCode(db,env,challenge.challengeId,{now:now+61000,fetcher:mail.fetcher});
await assert.rejects(()=>confirmEmailCode(db,env,challenge.challengeId,codeOf(mail.messages[0]),{now:now+62000}),error=>error.status===410);checks++;
const successes=await Promise.allSettled([1,2].map(()=>confirmEmailCode(db,env,renewed.challengeId,codeOf(mail.messages[1]),{now:now+62000})));
check(successes.filter(result=>result.status==='fulfilled').length===1,'concurrent verification creates exactly one account');
const user=successes.find(result=>result.status==='fulfilled').value.user;
check(user.role==='user'&&user.email===details.email,'verified registration is a customer account');
const saved=await db.prepare('SELECT * FROM users WHERE id=?').bind(user.id).first();
check(saved.email_verified_at&&saved.email_marketing===1&&saved.email_birthday===1&&await verifyPassword('OnlyTest@123',saved.password_hash),'verification preserves consent and password hash');
await assert.rejects(()=>confirmEmailCode(db,env,renewed.challengeId,codeOf(mail.messages[1]),{now:now+63000}),error=>error.status===410);checks++;

for(const scenario of ['wrong','expired','provider','rate']){
    const isolated=database(),inbox=capture();
    const opts={now,fetcher:inbox.fetcher};
    if(scenario==='provider'){
        await assert.rejects(()=>requestEmailCode(isolated,env,details,{...opts,fetcher:async()=>new Response('',{status:503})}),error=>error.status===503);
        check((await isolated.prepare('SELECT COUNT(*) AS n FROM email_challenges').first()).n===0,'send failure leaves no usable challenge or account');
        continue;
    }
    const ch=await requestEmailCode(isolated,env,details,opts),code=codeOf(inbox.messages[0]);
    if(scenario==='wrong'){
        for(let i=0;i<5;i++) await assert.rejects(()=>confirmEmailCode(isolated,env,ch.challengeId,code==='000000'?'000001':'000000',{now}),error=>error.status===400);
        await assert.rejects(()=>confirmEmailCode(isolated,env,ch.challengeId,code,{now}),error=>error.status===410);
        check(!await isolated.prepare('SELECT id FROM users').first(),'five wrong attempts block even the correct OTP');
    }
    if(scenario==='expired'){
        await assert.rejects(()=>confirmEmailCode(isolated,env,ch.challengeId,code,{now:now+600001}),error=>error.status===410);checks++;
    }
    if(scenario==='rate'){
        const start=Math.floor(now/3600000)*3600000+1000;
        const rateDb=database();
        for(let i=0;i<5;i++) await requestEmailCode(rateDb,env,details,{...opts,now:start+i*61000});
        await assert.rejects(()=>requestEmailCode(rateDb,env,details,{...opts,now:start+6*61000}),error=>error.status===429);checks++;
    }
}

function member(database,id,options={}){
    database.sqlite.prepare(`INSERT INTO users(id,name,email,password_hash,role,created_at,birth_date,email_verified_at,email_marketing,email_birthday,email_unsubscribe_token)
        VALUES (?,?,?,'test','user',?,?,?,?,?,?)`).run(id,id,`${id}@example.test`,new Date(now).toISOString(),options.birthDate||'2000-01-15',options.verified===false?null:new Date(now).toISOString(),options.marketing===false?0:1,options.birthday===false?0:1,'a'.repeat(64));
}
function cinema(database){
    database.sqlite.exec(`INSERT INTO movies VALUES ('movie','Phim thử','Test','[]',90,0,'P','/poster','/backdrop','Description','Director','[]','2026-01-01','now');
      INSERT INTO rooms VALUES ('room','Phòng 1',4,6,'Standard');`);
    database.sqlite.prepare("INSERT INTO showtimes VALUES ('show','movie','room',?,50000,'2D')").run(new Date(now+86400000).toISOString());
}
function booking(database,id,userId){
    return database.prepare("INSERT INTO bookings(id,user_id,showtime_id,seats,combos,total,code,status,created_at,payment_method) VALUES (?,?,'show','[\"A1\"]','[]',50000,?,'paid',?,'bank')").bind(id,userId,id,new Date(now).toISOString());
}
const jobs=database();member(jobs,'one');member(jobs,'two',{marketing:false,verified:false});cinema(jobs);
await jobs.batch([booking(jobs,'ticket1','one')]);
check((await jobs.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE kind='booking'").first()).n===1,'booking and email event commit together');
await assert.rejects(()=>jobs.batch([booking(jobs,'rolled-back','one'),booking(jobs,'ticket1','one')]));
check(!await jobs.prepare("SELECT id FROM email_outbox WHERE source_id='rolled-back'").first(),'rolled back booking leaves no email event');
await booking(jobs,'ticket2','two').run();
check(!await jobs.prepare("SELECT id FROM email_outbox WHERE source_id='ticket2'").first(),'unverified account receives no notification');
const inbox=capture();
const jobEnv={...env,DB:jobs};const jobOptions={now,fetcher:inbox.fetcher,delay:async()=>{},limit:20};
await Promise.all([runEmailJobs(jobEnv,jobOptions),runEmailJobs(jobEnv,jobOptions)]);
check(inbox.messages.length===1,'concurrent queue workers claim an email only once');
check(inbox.messages[0].payload.text.includes('giả lập'),'booking email accurately describes simulated payment');
await jobs.prepare("UPDATE bookings SET status='cancelled' WHERE id='ticket1'").run();
await jobs.prepare("UPDATE bookings SET status='cancelled' WHERE id='ticket1'").run();
check((await jobs.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE kind='cancel'").first()).n===1,'repeated cancellation produces one notification');
await runEmailJobs(jobEnv,jobOptions);
check(inbox.messages.at(-1).payload.subject.includes('Đã hủy'),'cancellation notification is sent');

jobs.sqlite.exec("INSERT INTO promotions VALUES ('promo','EMAIL10',10,0,1)");
check((await jobs.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE kind='promotion'").first()).n===1,'promotion targets only verified opted-in members');
jobs.sqlite.exec("UPDATE promotions SET active=0 WHERE id='promo'; UPDATE promotions SET active=1 WHERE id='promo'");
check((await jobs.prepare("SELECT COUNT(*) AS n FROM email_outbox WHERE kind='promotion'").first()).n===1,'reactivating the same promotion does not duplicate notifications');
jobs.sqlite.exec("UPDATE users SET email_marketing=0 WHERE id='one'");
await runEmailJobs(jobEnv,jobOptions);
check((await jobs.prepare("SELECT status FROM email_outbox WHERE kind='promotion'").first()).status==='skipped','opting out before delivery suppresses queued promotions');

const retryDb=database();member(retryDb,'retry');cinema(retryDb);await booking(retryDb,'retry-ticket','retry').run();
let attempts=[];
const flaky=async(_url,options)=>{attempts.push({key:options.headers['Idempotency-Key'],body:options.body});return attempts.length===1?new Response('',{status:503}):Response.json({id:'resend-test'});};
await runEmailJobs({...env,DB:retryDb},{...jobOptions,fetcher:flaky});
check((await retryDb.prepare('SELECT status FROM email_outbox').first()).status==='pending','temporary email failure leaves booking intact and queues retry');
await runEmailJobs({...env,DB:retryDb},{...jobOptions,now:now+300000,fetcher:flaky});
check(attempts.length===2&&attempts[0].key===attempts[1].key&&attempts[0].body===attempts[1].body,'retry reuses exactly the same payload and idempotency key');
await booking(retryDb,'stale','retry').run();
await runEmailJobs({...env,DB:retryDb},{...jobOptions,now:now+24*3600000,fetcher:flaky});
check((await retryDb.prepare("SELECT status FROM email_outbox WHERE source_id='stale'").first()).status==='failed','no automatic send after safe retry window');

const birthdays=database();member(birthdays,'leap',{birthDate:'2000-02-29'});member(birthdays,'no-birthday',{birthDate:'2000-02-28',birthday:false});
await enqueueBirthdays(birthdays,Date.parse('2027-02-28T00:59:00Z'));
check(!await birthdays.prepare('SELECT id FROM email_outbox').first(),'birthday email waits until 08:00 Vietnam time');
await enqueueBirthdays(birthdays,Date.parse('2027-02-28T01:00:00Z'));
await enqueueBirthdays(birthdays,Date.parse('2027-02-28T01:05:00Z'));
check((await birthdays.prepare('SELECT COUNT(*) AS n FROM email_outbox').first()).n===1,'leap birthday falls on February 28 in ordinary years, once per year');
await enqueueBirthdays(birthdays,Date.parse('2028-02-28T01:00:00Z'));
check((await birthdays.prepare('SELECT COUNT(*) AS n FROM email_outbox').first()).n===1,'leap-year birthday does not fire one day early');
await enqueueBirthdays(birthdays,Date.parse('2028-02-29T01:00:00Z'));
check((await birthdays.prepare('SELECT COUNT(*) AS n FROM email_outbox').first()).n===2,'birthday fires again on February 29 in a leap year');

const oldEmail=saved.email;
db.sqlite.prepare('UPDATE users SET email=? WHERE id=?').run('changed@example.test',user.id);
const changed=await db.prepare('SELECT * FROM users WHERE id=?').bind(user.id).first();
check(!changed.email_verified_at&&!changed.email_marketing&&!changed.email_birthday&&!changed.email_unsubscribe_token,'changing email revokes verification and consent');
const verifyInbox=capture();
const verify=await requestEmailCode(db,env,{purpose:'verify',userId:user.id,name:user.name,email:changed.email},{now,fetcher:verifyInbox.fetcher,ip:'verify-test'});
await assert.rejects(()=>confirmEmailCode(db,env,verify.challengeId,codeOf(verifyInbox.messages[0]),{now,userId:'someone-else'}),error=>error.status===410);checks++;
const verified=await confirmEmailCode(db,env,verify.challengeId,codeOf(verifyInbox.messages[0]),{now,userId:user.id});
check(!verified.registered&&verified.user.email!==oldEmail,'existing-account verification requires its logged-in owner');
const unsub=emailPayload(env,changed.email,'Test','Test',`https://cinema.example.test/email/unsubscribe?token=${'b'.repeat(64)}`);
check(unsub.headers['List-Unsubscribe-Post']==='List-Unsubscribe=One-Click'&&unsub.html.includes('Ngừng nhận'),'optional emails include one-click unsubscribe headers and visible link');
console.log(`\n${checks} email checks passed; no external email was sent.`);
