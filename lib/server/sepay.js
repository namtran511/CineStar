// Shared payment rules use Web Crypto and D1 only (also exercised against SQLite).
export const PAYMENT_CLOCK = "CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)";
const bankKey = bank => ({ MB: "MBBANK", VCB: "VIETCOMBANK" })[String(bank).toUpperCase()] || String(bank).replace(/[^a-z0-9]/gi, "").toUpperCase();

export function paymentConfiguration(env = {}) {
    const mode = env.APP_ENV === "production" || env.PAYMENT_MODE === "sepay" ? "sepay" : "demo";
    const bank = String(env.SEPAY_BANK || "").trim();
    const account = String(env.SEPAY_ACCOUNT_NUMBER || "").trim();
    const accountName = String(env.SEPAY_ACCOUNT_NAME || "").trim();
    const secret = String(env.SEPAY_WEBHOOK_SECRET || "");
    return { mode, bank, account, accountName, secret,
        configured: mode === "sepay" && /^[A-Za-z0-9]{2,30}$/.test(bank) && /^[A-Za-z0-9]{4,40}$/.test(account) && accountName.length > 0 && secret.length >= 32 };
}

export function publicPaymentConfiguration(env) {
    const { mode, configured } = paymentConfiguration(env);
    return { mode, configured };
}

export function paymentInstructions(row) {
    if (row.payment_provider !== "sepay" || row.status !== "pending") return null;
    const destination = JSON.parse(row.payment_destination);
    const qr = new URL("https://vietqr.app/img");
    for (const [key, value] of Object.entries({ acc: destination.account, bank: destination.bank,
        amount: row.total, des: row.code, template: "compact", showinfo: "true", holder: destination.accountName })) qr.searchParams.set(key, String(value));
    return { ...destination, amount: Number(row.total), content: row.code, qrUrl: qr.href };
}

export async function verifySePaySignature(rawBody, headers, secret, now = Date.now()) {
    const timestamp = headers.get("X-SePay-Timestamp") || "";
    const signature = headers.get("X-SePay-Signature") || "";
    if (secret.length < 32 || !/^\d{10,11}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
    const bytes = Uint8Array.from(signature.slice(7).match(/../g), byte => parseInt(byte, 16));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return crypto.subtle.verify("HMAC", key, bytes, encoder.encode(`${timestamp}.${rawBody}`));
}

export async function expirePendingPayments(db) {
    return db.prepare(`UPDATE bookings SET status='expired' WHERE status='pending' AND expires_at<=${PAYMENT_CLOCK}`).run();
}

export function validSePayPayload(payload) {
    return payload && typeof payload === "object" && !Array.isArray(payload)
        && Number.isSafeInteger(payload.id) && payload.id > 0
        && typeof payload.gateway === "string" && payload.gateway.length > 0 && payload.gateway.length <= 100
        && ["in", "out"].includes(payload.transferType)
        && Number.isSafeInteger(payload.transferAmount) && payload.transferAmount > 0
        && typeof payload.accountNumber === "string" && payload.accountNumber.length <= 80
        && typeof payload.content === "string" && payload.content.length <= 8000
        && (payload.code == null || typeof payload.code === "string" && payload.code.length <= 100);
}

// Dashboard "Gửi thử" uses a mock ID of zero. It can check delivery and
// authentication, but must never enter the transaction ledger or settle an order.
export function isSePayTestPayload(payload) {
    return payload?.id === 0 && validSePayPayload({ ...payload, id: 1 });
}

export async function settleSePayTransaction(db, configuration, payload, rawBody) {
    if (!validSePayPayload(payload)) throw new Error("Invalid SePay payload");
    const transactionId = String(payload.id);
    // An explicit, conflicting code must never be replaced with another match.
    const code = (payload.code || payload.content.match(/(?:^|[^A-Z0-9])(CV[A-F0-9]{10})(?![A-Z0-9])/i)?.[1] || "").toUpperCase();
    const initial = payload.transferType !== "in" ? "outgoing" : payload.accountNumber !== configuration.account ? "wrong_account" : bankKey(payload.gateway) !== bankKey(configuration.bank) ? "wrong_bank" : "received";
    const now = new Date().toISOString();
    // All decisions and the unique transaction receipt commit together. Retries
    // cannot credit a second order or repeat a status/email/membership transition.
    await db.batch([
        db.prepare(`INSERT INTO payment_events (transaction_id,booking_id,code,amount,account_number,gateway,transfer_type,outcome,raw_payload,received_at)
            VALUES (?,(SELECT id FROM bookings WHERE code=?),?,?,?,?,?,?,?,?) ON CONFLICT(transaction_id) DO NOTHING`)
            .bind(transactionId, code, code, payload.transferAmount, payload.accountNumber, payload.gateway, payload.transferType, initial, rawBody, now),
        db.prepare(`UPDATE bookings SET status='expired' WHERE status='pending' AND code=? AND expires_at<=${PAYMENT_CLOCK}`).bind(code),
        db.prepare(`UPDATE bookings SET status='paid',paid_at=?,payment_transaction_id=?
            WHERE code=? AND status='pending' AND payment_provider='sepay' AND expires_at>${PAYMENT_CLOCK} AND json_extract(payment_destination,'$.bank')=?
            AND EXISTS (SELECT 1 FROM payment_events e WHERE e.transaction_id=? AND e.outcome='received'
                AND e.code=bookings.code AND e.amount=bookings.total AND e.account_number=json_extract(bookings.payment_destination,'$.account'))`)
            .bind(now, transactionId, code, configuration.bank, transactionId),
        db.prepare(`UPDATE payment_events SET outcome=CASE
            WHEN EXISTS(SELECT 1 FROM bookings b WHERE b.payment_transaction_id=payment_events.transaction_id) THEN 'paid'
            WHEN booking_id IS NULL THEN 'unmatched'
            WHEN EXISTS(SELECT 1 FROM bookings b WHERE b.id=booking_id AND b.payment_provider!='sepay') THEN 'wrong_provider'
            WHEN EXISTS(SELECT 1 FROM bookings b WHERE b.id=booking_id AND json_extract(b.payment_destination,'$.account')!=payment_events.account_number) THEN 'wrong_account'
            WHEN EXISTS(SELECT 1 FROM bookings b WHERE b.id=booking_id AND b.status IN ('expired','cancelled')) THEN 'late_payment'
            WHEN EXISTS(SELECT 1 FROM bookings b WHERE b.id=booking_id AND b.status IN ('paid','checked_in')) THEN 'extra_payment'
            ELSE 'amount_mismatch' END WHERE transaction_id=? AND outcome='received'`).bind(transactionId),
    ]);
    const event = await db.prepare("SELECT outcome FROM payment_events WHERE transaction_id=?").bind(transactionId).first();
    return { success: true, outcome: event.outcome };
}
