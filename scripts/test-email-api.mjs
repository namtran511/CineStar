import assert from 'node:assert/strict';
import { randomUUID,randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { writeFileSync,unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { createQaCustomer } from './qa-customer.mjs';
const base=new URL('http://127.0.0.1:5173'),stamp=randomUUID(),fixture={user:'',room:'',show:'',incident:randomUUID(),promo:''};
const sqlPath=resolve('.sites-runtime',`email-api-${stamp}.sql`);
let count=0;
function check(value,message){assert.ok(value,message);count++;console.log('PASS '+message);}
async function call(path,method='GET',body,cookie=''){
    const response=await fetch(new URL(path,base),{method,headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
function sql(source){writeFileSync(sqlPath,source);try{const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--persist-to','.wrangler/state','--config','.sites-runtime/db-init.json','--file',sqlPath,'--json'],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr||result.stdout);return JSON.parse(result.stdout).flatMap(item=>item.results||[]);}finally{unlinkSync(sqlPath);}}
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
try{
    const admin=await call('/api/auth/login','POST',{email:'admin@cineverse.vn',password:'Demo@123'});assert.equal(admin.status,200);
    const status=await call('/api/admin/email','GET',undefined,admin.cookie);
    assert.equal(status.body.configured,false,'Run API tests without email credentials; this suite never sends real mail.');
    const registration={name:'Email QA',email:`email-otp-${stamp}@cineverse.test`,password:'EmailTest@123',birthDate:'2000-01-15',role:'admin'};
    for (const acceptedPolicies of [undefined,false,'true']) {
        const rejected=await call('/api/auth/register','POST',{...registration,acceptedPolicies});
        check(rejected.status===400&&!rejected.cookie,'registration requires explicit policy acceptance before requesting OTP');
    }
    const register=await call('/api/auth/register','POST',{...registration,acceptedPolicies:true});
    check(register.status===503&&!register.cookie&&!register.body.user,'registration cannot bypass OTP when email is unconfigured');
    const customer=await createQaCustomer(base,{name:'Email API QA',email:`email-api-${stamp}@cineverse.test`,password:'EmailTest@123',birthDate:'2000-01-15'});fixture.user=customer.body.user.id;
    const staff=await call('/api/auth/login','POST',{email:'staff@cineverse.vn',password:'Demo@123'});
    for(const [cookie,statusCode] of [['',401],[customer.cookie,403],[staff.cookie,403]]){
        check((await call('/api/admin/email','GET',undefined,cookie)).status===statusCode,'email status is admin-only');
        check((await call('/api/admin/email/incidents','POST',{},cookie)).status===statusCode,'incident sending is admin-only');
    }
    const preferences=await call('/api/email/preferences','GET',undefined,customer.cookie);
    check(!preferences.body.verified&&!preferences.body.marketing&&!preferences.body.birthday,'legacy/admin-created users start unverified with no optional mail');
    check((await call('/api/email/preferences','PATCH',{marketing:true,birthday:true},customer.cookie)).status===200,'customer can opt into both optional notifications');
    check((await call('/api/email/preferences','PATCH',{marketing:true,birthday:true,email:'other@example.test'},customer.cookie)).status===400,'preferences cannot change email or another account');
    const token=randomBytes(32).toString('hex');
    sql(`UPDATE users SET email_verified_at=${quote(new Date().toISOString())},email_unsubscribe_token=${quote(token)} WHERE id=${quote(fixture.user)};`);
    const catalog=(await call('/api/bootstrap')).body;
    const movie=catalog.movies.find(movie=>movie.status==='now');
    const room=await call('/api/admin/rooms','POST',{name:`Email QA ${stamp}`,type:'Standard',rows:2,cols:4},admin.cookie);assert.equal(room.status,201);fixture.room=room.body.room.id;
    const show=await call('/api/admin/showtimes','POST',{movieId:movie.id,roomId:fixture.room,startTime:new Date(Date.now()+86400000).toISOString(),price:50000,format:'2D'},admin.cookie);assert.equal(show.status,201);fixture.show=show.body.showtime.id;
    const holdToken=randomUUID();assert.equal((await call(`/api/showtimes/${fixture.show}/seats`,'PUT',{holdToken,seats:['A1']},customer.cookie)).status,200);
    const booked=await call('/api/bookings','POST',{showtimeId:fixture.show,holdToken,seats:['A1'],combos:[],paymentMethod:'bank'},customer.cookie);assert.equal(booked.status,201);
    const incident={requestId:fixture.incident,showtimeId:fixture.show,subject:'Thông báo QA',message:'Sự cố thử nghiệm nội bộ, không gửi mail ra ngoài.'};
    const created=await call('/api/admin/email/incidents','POST',incident,admin.cookie);
    check(created.status===201&&created.body.queued===1,'incident queues only the affected verified customer');
    check((await call('/api/admin/email/incidents','POST',incident,admin.cookie)).body.queued===1,'retrying incident request does not duplicate recipients');
    check((await call('/api/admin/email/incidents','POST',{...incident,message:'Nội dung khác không được ghi đè.'},admin.cookie)).status===409,'incident request ID cannot replace an earlier message');
    const promo=await call('/api/admin/promotions','POST',{code:`EMAIL${stamp.slice(0,8)}`,discountPercent:10,minTotal:0,active:true},admin.cookie);assert.equal(promo.status,201);fixture.promo=promo.body.promotion.id;
    const rows=sql(`SELECT kind,status FROM email_outbox WHERE user_id=${quote(fixture.user)};`);
    check(['booking','incident','promotion'].every(kind=>rows.some(row=>row.kind===kind&&row.status==='pending')),'actual D1 triggers queue booking and promotion without depending on email provider');
    check((await call(`/api/bookings/${booked.body.booking.id}`,'PATCH',{action:'cancel'},customer.cookie)).status===200,'cancellation succeeds without mail service');
    check(sql(`SELECT id FROM email_outbox WHERE user_id=${quote(fixture.user)} AND kind='cancel';`).length===1,'actual cancellation commits email event');
    check((await call('/api/email/unsubscribe','POST',{token:'invalid'})).status===400,'invalid unsubscribe token is rejected');
    check((await fetch(new URL(`/api/email/unsubscribe?token=${token}`,base))).status===405,'GET link scanning cannot unsubscribe');
    const unsub=await fetch(new URL(`/api/email/unsubscribe?token=${token}`,base),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'});
    check(unsub.status===200,'standard one-click unsubscribe works without login');
    const after=(await call('/api/email/preferences','GET',undefined,customer.cookie)).body;
    check(after.verified&&!after.marketing&&!after.birthday,'unsubscribe preserves verification and disables both optional categories');
    check((await call('/api/admin/email','POST',{},admin.cookie)).status===503,'queue UI reports missing configuration accurately');
    console.log(`\n${count} email API checks passed without sending real email.`);
}finally{
    if(fixture.user)sql(`DELETE FROM email_outbox WHERE user_id=${quote(fixture.user)}; DELETE FROM email_incidents WHERE id=${quote(fixture.incident)};
      DELETE FROM booked_seats WHERE booking_id IN (SELECT id FROM bookings WHERE user_id=${quote(fixture.user)});
      DELETE FROM membership_transactions WHERE user_id=${quote(fixture.user)}; DELETE FROM bookings WHERE user_id=${quote(fixture.user)};
      DELETE FROM seat_hold_sessions WHERE user_id=${quote(fixture.user)}; DELETE FROM sessions WHERE user_id=${quote(fixture.user)};
      DELETE FROM users WHERE id=${quote(fixture.user)}; DELETE FROM showtimes WHERE id=${quote(fixture.show)}; DELETE FROM rooms WHERE id=${quote(fixture.room)};
      DELETE FROM promotions WHERE id=${quote(fixture.promo)};`);
}
