import { requireUser } from "@/lib/server/auth";
import { getDb, getEnv } from "@/lib/server/db";
import { api, HttpError, jsonBody, stringField } from "@/lib/server/http";
import { expirePendingPayments, publicPaymentConfiguration } from "@/lib/server/sepay";

export const GET = api(async request => {
    await requireUser(request, ["admin"]);
    const db = await getDb();
    await expirePendingPayments(db);
    const events = await db.prepare("SELECT transaction_id,code,amount,account_number,transfer_type,outcome,received_at FROM payment_events ORDER BY received_at DESC,transaction_id DESC LIMIT 100").all();
    const refunds = await db.prepare("SELECT id,code,total,refund_status FROM bookings WHERE payment_provider='sepay' AND refund_status='pending' ORDER BY created_at DESC LIMIT 100").all();
    return Response.json({ configuration: publicPaymentConfiguration(getEnv()), events: events.results, refunds: refunds.results });
});

export const POST = api(async request => {
    await requireUser(request, ["admin"]);
    const body = await jsonBody(request);
    if (body.action !== "record_refund") throw new HttpError(400, "Thao tác không hợp lệ.");
    stringField(body.reason, "Thông tin hoàn tiền (ngân hàng, mã giao dịch)", 10, 500);
    const id = stringField(body.bookingId, "Mã đơn", 1, 100);
    const result = await (await getDb()).prepare("UPDATE bookings SET refund_status='refunded' WHERE id=? AND status='cancelled' AND payment_provider='sepay' AND refund_status='pending'").bind(id).run();
    if (!result.meta.changes) throw new HttpError(409, "Đơn không còn chờ hoàn tiền.");
    return Response.json({ success: true });
});
