import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { createHmac } from "node:crypto";
import { paymentConfiguration, publicPaymentConfiguration, paymentInstructions, verifySePaySignature, validSePayPayload, isSePayTestPayload, settleSePayTransaction, expirePendingPayments } from "../lib/server/sepay.js";
import { notificationContent } from "../lib/server/email-jobs.js";

// In-memory SQLite applies every real migration, including seat, email and audit
// triggers. No bank, SePay account, existing database or email provider is used.
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for (const file of readdirSync("drizzle").filter(name => name.endsWith(".sql")).sort()) sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
function wrap(sql, args = []) { return {
    bind(...values) { return wrap(sql, values); },
    async first() { return sqlite.prepare(sql).get(...args) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...args) }; },
    execute() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
    async run() { return this.execute(); },
}; }
const db = { prepare: sql => wrap(sql), async batch(statements) {
    sqlite.exec("BEGIN");
    try { const results = statements.map(statement => statement.execute()); sqlite.exec("COMMIT"); return results; }
    catch (error) { sqlite.exec("ROLLBACK"); throw error; }
} };
let checks = 0;
function check(value, label) { assert.ok(value, label); checks++; console.log(`PASS ${label}`); }
const env = { APP_ENV: "production", SEPAY_BANK: "MBBank", SEPAY_ACCOUNT_NUMBER: "0000000000", SEPAY_ACCOUNT_NAME: "SEPAY QA", SEPAY_WEBHOOK_SECRET: "test-only-secret-never-used-in-production-123456" };
const config = paymentConfiguration(env);
check(config.configured, "complete production configuration enables SePay");
check(!paymentConfiguration({ ...env, SEPAY_WEBHOOK_SECRET: "" }).configured, "missing secret disables payments");
check(paymentConfiguration({ ...env, PAYMENT_MODE: "demo" }).mode === "sepay", "production cannot opt into simulated paid orders");
check(!JSON.stringify(publicPaymentConfiguration(env)).includes(env.SEPAY_WEBHOOK_SECRET), "public config never contains webhook secret");
const raw = JSON.stringify({ id: 123, content: "thanh toán vé" });
const timestamp = String(Math.floor(Date.now() / 1000));
function signed(body, time = timestamp) { return new Headers({ "X-SePay-Timestamp": time, "X-SePay-Signature": `sha256=${createHmac("sha256", env.SEPAY_WEBHOOK_SECRET).update(`${time}.${body}`).digest("hex")}` }); }
check(await verifySePaySignature(raw, signed(raw), config.secret), "valid HMAC matches timestamp and exact UTF-8 body");
check(!await verifySePaySignature(raw + " ", signed(raw), config.secret), "modified raw body fails authentication");
check(!await verifySePaySignature(raw, signed(raw), "different-test-secret-with-more-than-32-chars"), "wrong secret fails authentication");
check(!await verifySePaySignature(raw, signed(raw, String(Number(timestamp) - 301)), config.secret), "stale signed requests are rejected");
check(!await verifySePaySignature(raw, new Headers(), config.secret), "unsigned requests are rejected");

const now = Date.now();
sqlite.prepare("INSERT INTO users(id,name,email,password_hash,role,created_at,points,email_verified_at) VALUES ('user','QA','qa@example.test','hash','user',?,100,?)").run(new Date().toISOString(),new Date().toISOString());
sqlite.exec(`INSERT INTO movies VALUES ('movie','Movie','Movie','[]',120,0,'P','','','Test','Test','[]','2026-01-01','now');
    INSERT INTO rooms VALUES ('room','Room',4,12,'Standard');`);
sqlite.prepare("INSERT INTO showtimes VALUES ('show','movie','room',?,100000,'2D')").run(new Date(now + 86400000).toISOString());
let sequence = 0;
function order({ points = 0, birthday = false, reward = false, total = 100000 } = {}) {
    const index = ++sequence, id = `booking-${index}`, code = `CV${String(index).padStart(10, "0")}`, token = `hold-${index}`, seat = `A${index}`;
    const expires = Date.now() + 600000;
    sqlite.prepare("INSERT INTO seat_hold_sessions VALUES (?,'user','show',?,?)").run(token, expires - 600000, expires);
    sqlite.prepare("INSERT INTO seat_holds VALUES (?,?,'show',?)").run(`seat-${index}`, token, seat);
    if (reward) sqlite.prepare("INSERT INTO membership_rewards(id,user_id,reward_key,name,type,points_cost,code,status,created_at) VALUES (?,'user','ticket','Ticket','ticket',120,?,'used',?)").run(`reward-${index}`,`R${index}`,new Date().toISOString());
    sqlite.prepare(`INSERT INTO bookings(id,user_id,showtime_id,seats,combos,total,code,status,created_at,payment_method,seat_hold_token,payment_provider,payment_destination,expires_at,points_spent,birthday_year,reward_id)
        VALUES (?,'user','show',?,'[]',?,?,'pending',?,'bank',?,'sepay',?,?,?, ?,?)`)
        .run(id, JSON.stringify([seat]), total, code, new Date().toISOString(), token, JSON.stringify({ bank: config.bank, account: config.account, accountName: config.accountName }), expires, points, birthday ? 2026 : null, reward ? `reward-${index}` : null);
    sqlite.prepare("INSERT INTO booked_seats VALUES (?,?,'show',?)").run(`sold-${index}`,id,seat);
    sqlite.prepare("DELETE FROM seat_hold_sessions WHERE id=?").run(token);
    if (points) sqlite.prepare("UPDATE users SET points=points-? WHERE id='user'").run(points);
    if (birthday) sqlite.prepare("INSERT INTO membership_birthday_claims VALUES ('user',2026,?)").run(id);
    if (reward) sqlite.prepare("INSERT INTO membership_reward_claims VALUES (?,?)").run(`reward-${index}`,id);
    return { id, code, seat, index, expires };
}
const status = item => sqlite.prepare("SELECT status FROM bookings WHERE id=?").get(item.id).status;
const count = sql => sqlite.prepare(sql).get().n;
let transaction = 1000;
const payload = (item, values = {}) => ({ id: ++transaction, gateway: "MBBank", accountNumber: config.account, code: item.code, content: item.code, transferType: "in", transferAmount: 100000, ...values });
const receive = async data => settleSePayTransaction(db,config,data,JSON.stringify(data));

const first = order();
check(count("SELECT count(*) n FROM email_outbox WHERE kind='booking'") === 0, "pending orders never queue ticket email");
const instructions = paymentInstructions(sqlite.prepare("SELECT * FROM bookings WHERE id=?").get(first.id));
const qr = new URL(instructions.qrUrl);
check(qr.searchParams.get("des") === first.code && qr.searchParams.get("amount") === "100000" && qr.searchParams.get("acc") === config.account, "QR carries server amount, order code and receiver snapshot");
const success = payload(first);
const probe = { ...success, id: 0 };
check(isSePayTestPayload(probe) && !validSePayPayload(probe), "dashboard mock ID zero is recognized only as a connectivity test");
check(!isSePayTestPayload({ id: 0 }) && !isSePayTestPayload({ ...probe, transferAmount: -1 }), "malformed mock payloads are still rejected");
check(!isSePayTestPayload({ ...success, id: -1 }) && !isSePayTestPayload({ ...success, id: "0" }), "invalid transaction IDs cannot become test probes");
await assert.rejects(receive(probe), /Invalid SePay payload/);
check(status(first) === "pending" && count("SELECT count(*) n FROM payment_events") === 0, "mock receipt cannot settle an order or enter the transaction ledger");
check((await receive(success)).outcome === "paid" && status(first) === "paid", "matching bank transfer marks the pending order paid");
check(count("SELECT count(*) n FROM email_outbox WHERE kind='booking'") === 1, "settlement queues exactly one ticket email");
const audits = count("SELECT count(*) n FROM audit_logs");
await Promise.all([receive(success),receive(success)]);
check(count("SELECT count(*) n FROM payment_events") === 1 && count("SELECT count(*) n FROM audit_logs") === audits, "repeated deliveries do not repeat mutations or audit events");
check(count("SELECT count(*) n FROM email_outbox WHERE kind='booking'") === 1, "repeated deliveries never send a second ticket email");
check(paymentInstructions(sqlite.prepare("SELECT * FROM bookings WHERE id=?").get(first.id)) === null, "paid orders no longer expose a payable QR");
check((await receive(payload(first))).outcome === "extra_payment", "second real transfer for a paid order is flagged for review");

const second = order();
check((await receive(payload(second,{transferAmount:99999}))).outcome === "amount_mismatch" && status(second) === "pending", "underpayment cannot issue a ticket");
check((await receive(payload(second,{transferAmount:100001}))).outcome === "amount_mismatch" && status(second) === "pending", "overpayment is retained for reconciliation");
check((await receive(payload(second,{accountNumber:'1111111111'}))).outcome === "wrong_account" && status(second) === "pending", "another receiver account cannot settle an order");
check((await receive(payload(second,{gateway:'Vietcombank'}))).outcome === "wrong_bank" && status(second) === "pending", "same account number at another bank cannot settle an order");
check((await receive(payload(second,{transferType:'out'}))).outcome === "outgoing" && status(second) === "pending", "outgoing money never credits an order");
check((await receive(payload(second,{code:'CVFFFFFFFFFF'}))).outcome === "unmatched" && status(second) === "pending", "unknown explicit code does not fall back to another code in content");
check((await receive(payload(second,{code:null,content:`Chuyen khoan ${second.code} ve phim`}))).outcome === "paid", "order code can be recovered from bank transfer content");
check(!validSePayPayload({...success,transferAmount:1.1}) && !validSePayPayload({...success,id:-1}), "invalid amounts and transaction IDs are rejected");

const third = order({ points: 20, birthday: true, reward: true });
sqlite.prepare("UPDATE bookings SET expires_at=? WHERE id=?").run(Date.now()-1000,third.id);
await expirePendingPayments(db);
await expirePendingPayments(db);
check(status(third) === "expired", "expiry uses the database clock");
check(sqlite.prepare("SELECT points FROM users WHERE id='user'").get().points === 100, "expired order restores reserved points exactly once");
check(!sqlite.prepare("SELECT id FROM booked_seats WHERE booking_id=?").get(third.id), "expired order releases its seat lock");
check(!sqlite.prepare("SELECT user_id FROM membership_birthday_claims WHERE booking_id=?").get(third.id), "expiry restores birthday eligibility");
check(sqlite.prepare("SELECT status FROM membership_rewards WHERE id=?").get(`reward-${third.index}`).status === "available", "expiry restores a reserved reward ticket");
check((await receive(payload(third))).outcome === "late_payment" && status(third) === "expired", "late transfer cannot revive expired seats");

const fourth = order({points:10});
sqlite.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND status='pending'").run(fourth.id);
check(sqlite.prepare("SELECT points FROM users WHERE id='user'").get().points === 100, "pending cancellation releases reserved points");
check((await receive(payload(fourth))).outcome === "late_payment", "transfer after cancellation is retained for review");
const fifth = order();
sqlite.prepare("UPDATE bookings SET expires_at=? WHERE id=?").run(Date.now()-1000,fifth.id);
check((await receive(payload(fifth))).outcome === "late_payment" && status(fifth) === "expired", "webhook itself expires stale orders before deciding settlement");
const sixth = order();
const failure = payload(sixth);
sqlite.exec("CREATE TRIGGER fail_payment_test BEFORE UPDATE OF status ON bookings WHEN NEW.status='paid' BEGIN SELECT RAISE(ABORT,'test_failure'); END");
await assert.rejects(receive(failure),/test_failure/);
check(!sqlite.prepare("SELECT transaction_id FROM payment_events WHERE transaction_id=?").get(String(failure.id)) && status(sixth) === "pending", "database failure rolls back receipt and settlement together");
sqlite.exec("DROP TRIGGER fail_payment_test");
check((await receive(failure)).outcome === "paid", "delivery retry succeeds after a transactional failure");
sqlite.prepare("UPDATE bookings SET status='cancelled',refund_status='pending' WHERE id=?").run(sixth.id);
check((await receive(failure)).outcome === "paid" && status(sixth) === "cancelled", "replayed receipt never revives a cancelled paid order");
check(sqlite.prepare("SELECT payment_provider FROM bookings WHERE id=?").get(sixth.id).payment_provider === "sepay", "payment provenance survives cancellation");
const email = JSON.parse(sqlite.prepare("SELECT data FROM email_outbox WHERE id=?").get(`booking:${sixth.id}`).data);
check(!notificationContent('booking',email).text.includes('giả lập'), "paid ticket email describes actual settlement");
const cancellation = JSON.parse(sqlite.prepare("SELECT data FROM email_outbox WHERE id=?").get(`cancel:${sixth.id}`).data);
check(notificationContent('cancel',cancellation).text.includes('hoàn bằng vé'), "cancellation email explains ticket-credit compensation");
sqlite.prepare("UPDATE bookings SET refund_status='refunded' WHERE id=?").run(sixth.id);
check(sqlite.prepare("SELECT id FROM audit_logs WHERE entity_id=? AND after_json LIKE '%refunded%' LIMIT 1").get(sixth.id), "refund acknowledgement is audited");
console.log(`PASS ${checks} SePay checks against all real database migrations.`);
sqlite.close();
