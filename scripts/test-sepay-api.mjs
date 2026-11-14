import assert from "node:assert/strict";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID, createHmac } from "node:crypto";
import { createQaCustomer } from "./qa-customer.mjs";

const base = new URL(process.argv.find(arg => /^https?:\/\//.test(arg)) || "http://localhost:5173");
if (!["localhost","127.0.0.1","[::1]"].includes(base.hostname)) throw new Error("SePay API tests require a local development server.");
const envText = readFileSync(".dev.vars", "utf8");
const secret = envText.match(/^SEPAY_WEBHOOK_SECRET=([^\r\n]+)/m)?.[1].replace(/^["']|["']$/g, "");
if (!secret) throw new Error("Run npm run sepay:setup and start the local server in SePay mode first.");
const stamp = randomUUID(), fixture = { users: [], rooms: [], showtimes: [], bookings: [], transactions: [] };
const sqlFile = `.sites-runtime/sepay-api-${stamp}.sql`;
const quote = value => `'${String(value).replaceAll("'","''")}'`;
const ids = values => values.map(quote).join(",") || "''";
let checks = 0;
function check(value,label) { assert.ok(value,label); checks++; console.log(`PASS ${label}`); }
function execute(sql) {
    writeFileSync(sqlFile,sql,"utf8");
    try {
        const result = spawnSync(process.execPath,["node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--local","--persist-to",".wrangler/state","--config",".sites-runtime/db-init.json","--file",sqlFile,"--json"],{encoding:"utf8",windowsHide:true});
        assert.equal(result.status,0,result.stderr || result.stdout);
        return JSON.parse(result.stdout).flatMap(item=>item.results || []);
    } finally { rmSync(sqlFile,{force:true}); }
}
async function call(path,{method="GET",body,cookie="",headers={}}={}) {
    const response = await fetch(new URL(path,base),{method,headers:{"Content-Type":"application/json",Cookie:cookie,...headers},body:body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    return {status:response.status,body:await response.json(),cookie:response.headers.get("set-cookie")?.split(";")[0]};
}
async function login(email) { const response=await call("/api/auth/login",{method:"POST",body:{email,password:"Demo@123"}});assert.equal(response.status,200,JSON.stringify(response.body));return response.cookie; }
async function webhook(booking,overrides={},options={}) {
    const id = Date.now()*1000+fixture.transactions.length;
    fixture.transactions.push(String(id));
    const destination=booking.payment;
    const body = JSON.stringify({id,gateway:destination.bank,accountNumber:destination.account,content:booking.code,code:booking.code,transferType:"in",transferAmount:booking.total,...overrides});
    const timestamp=String(Math.floor(Date.now()/1000)+(options.timestampOffset || 0));
    const signature=createHmac("sha256",options.badSecret ? "incorrect-test-secret" : secret).update(`${timestamp}.${body}`).digest("hex");
    return { body,headers:{"X-SePay-Timestamp":timestamp,"X-SePay-Signature":`sha256=${signature}`},result:await call("/api/payments/sepay/webhook",{method:"POST",body,headers:{"X-SePay-Timestamp":timestamp,"X-SePay-Signature":`sha256=${signature}`}}) };
}
try {
    const bootstrap=await call("/api/bootstrap");
    check(bootstrap.body.payment?.mode === "sepay" && bootstrap.body.payment.configured,"local server is configured for real SePay workflow");
    check(!JSON.stringify(bootstrap.body).includes(secret),"bootstrap does not expose the signing secret");
    const admin=await login("admin@cineverse.vn"),staff=await login("staff@cineverse.vn");
    async function customer(label) {
        const response=await createQaCustomer(base,{name:`SePay QA ${label}`,email:`sepay-${label}-${stamp}@cineverse.test`,password:"SePayQa@123",birthDate:"2000-01-15"});
        fixture.users.push(response.body.user.id);return response;
    }
    const owner=await customer("owner"),other=await customer("other");
    const roomResponse=await call("/api/admin/rooms",{method:"POST",cookie:admin,body:{name:`SePay QA ${stamp.slice(0,8)}`,rows:4,cols:12,type:"Standard"}});
    assert.equal(roomResponse.status,201,JSON.stringify(roomResponse.body));fixture.rooms.push(roomResponse.body.room.id);
    const showResponse=await call("/api/admin/showtimes",{method:"POST",cookie:admin,body:{movieId:bootstrap.body.movies[0].id,roomId:fixture.rooms[0],startTime:new Date(Date.now()+86400000).toISOString(),price:100000,format:"2D"}});
    assert.equal(showResponse.status,201,JSON.stringify(showResponse.body));const show=showResponse.body.showtime;fixture.showtimes.push(show.id);
    async function order(seat,extra={},cookie=owner.cookie) {
        const holdToken=randomUUID();
        const held=await call(`/api/showtimes/${show.id}/seats`,{method:"PUT",cookie,body:{holdToken,seats:[seat]}});
        assert.equal(held.status,200,JSON.stringify(held.body));
        const body={showtimeId:show.id,holdToken,seats:[seat],combos:[],paymentMethod:"bank",...extra};
        const result=await call("/api/bookings",{method:"POST",cookie,body});
        if(result.body.booking?.id)fixture.bookings.push(result.body.booking.id);
        return {...result,request:body,held:held.body};
    }
    const first=await order("A1",{total:1,status:"paid"});
    assert.equal(first.status,201,JSON.stringify(first.body));const booking=first.body.booking;
    check(booking.status === "pending" && booking.total === 100000,"customer-supplied totals/status cannot skip real payment");
    check(booking.expiresAt === first.held.expiresAt,"checkout preserves the original seat-hold deadline");
    check(booking.payment?.content === booking.code && booking.payment.amount === 100000,"pending order returns its own QR instructions");
    check((await call(`/api/bookings/${booking.id}`)).status === 401,"order polling requires authentication");
    check((await call(`/api/bookings/${booking.id}`,{cookie:other.cookie})).status === 403,"another customer cannot read the payment QR");
    check((await call("/api/admin/payments",{cookie:owner.cookie})).status === 403 && (await call("/api/admin/payments",{cookie:staff})).status === 403,"reconciliation and refunds require admin role");
    check((await call(`/api/bookings/${booking.id}`,{method:"PATCH",cookie:owner.cookie,body:{action:"checkin"}})).status === 409,"unpaid orders cannot be checked in");
    const retried=await call("/api/bookings",{method:"POST",cookie:owner.cookie,body:first.request});
    check(retried.body.booking?.id === booking.id,"checkout retry recovers the same order without new seats or discounts");
    const conflict=await call(`/api/showtimes/${show.id}/seats`,{method:"PUT",cookie:other.cookie,body:{holdToken:randomUUID(),seats:["A1"]}});
    check(conflict.status === 409,"another customer cannot reserve a pending-payment seat");
    check((await webhook(booking,{}, {badSecret:true})).result.status === 401,"webhook rejects a forged signature");
    check((await webhook(booking,{}, {timestampOffset:-301})).result.status === 401,"webhook rejects an expired signature");
    check((await webhook(booking,{transferAmount:1})).result.body.outcome === "amount_mismatch","validly signed underpayment is recorded without issuing a ticket");
    check((await call(`/api/bookings/${booking.id}`,{cookie:owner.cookie})).body.booking.status === "pending","underpaid order remains pending");
    const settled=await webhook(booking);
    check(settled.result.status === 200 && settled.result.body.success && settled.result.body.outcome === "paid","valid signed payment settles through the public webhook endpoint");
    const paid=await call(`/api/bookings/${booking.id}`,{cookie:owner.cookie});
    check(paid.body.booking.status === "paid" && paid.body.booking.payment === null,"owner polling observes paid status and removes payable QR");
    check((await call("/api/payments/sepay/webhook",{method:"POST",body:settled.body,headers:settled.headers})).body.outcome === "paid","webhook retry acknowledges the same transaction");
    check((await call(`/api/bookings/${booking.id}`,{method:"PATCH",cookie:owner.cookie,body:{action:"cancel"}})).body.booking.refundStatus === "pending","paid bank cancellation enters the manual refund queue");
    check((await call("/api/admin/payments",{method:"POST",cookie:owner.cookie,body:{action:"record_refund",bookingId:booking.id,reason:"QA refund acknowledgement"}})).status === 403,"customer cannot acknowledge a refund");
    check((await call("/api/admin/payments",{method:"POST",cookie:admin,body:{action:"record_refund",bookingId:booking.id,reason:"QA isolated bank refund reference only"}})).status === 200,"admin can record an already-completed manual refund");
    const second=await order("A2");const pending=second.body.booking;
    execute(`UPDATE bookings SET expires_at=${Date.now()-1000} WHERE id=${quote(pending.id)}`);
    check((await call(`/api/bookings/${pending.id}`,{cookie:owner.cookie})).body.booking.status === "expired","polling expires an unpaid order");
    const seats=await call(`/api/showtimes/${show.id}/seats`);
    check(!seats.body.occupied.includes("A2"),"expired payment releases the seat for other customers");
    check((await webhook(pending)).result.body.outcome === "late_payment","late bank receipt is kept for manual review");
    const invalidMethod=await order("A3",{paymentMethod:"card"});
    check(invalidMethod.status === 400,"customer cannot choose a simulated card method in SePay mode");
    const cash=await order("A4",{paymentMethod:"cash"},staff);
    check(cash.body.booking?.status === "paid" && cash.body.booking.paymentProvider === "cash","staff can issue a ticket only using the cash counter flow");
    const overview=await call("/api/admin/payments",{cookie:admin});
    check(overview.status === 200 && overview.body.events.some(item=>item.code === booking.code),"admin can inspect actual webhook outcomes");
    console.log(`PASS ${checks} local SePay API checks. No bank transfer or external email was sent.`);
} finally {
    execute(`DELETE FROM payment_events WHERE transaction_id IN (${ids(fixture.transactions)});
        DELETE FROM email_outbox WHERE user_id IN (${ids(fixture.users)}) OR source_id IN (${ids(fixture.bookings)});
        DELETE FROM membership_transactions WHERE booking_id IN (${ids(fixture.bookings)});
        DELETE FROM bookings WHERE id IN (${ids(fixture.bookings)});
        DELETE FROM seat_hold_sessions WHERE showtime_id IN (${ids(fixture.showtimes)});
        DELETE FROM showtimes WHERE id IN (${ids(fixture.showtimes)});
        DELETE FROM rooms WHERE id IN (${ids(fixture.rooms)});
        DELETE FROM users WHERE id IN (${ids(fixture.users)});`);
}
