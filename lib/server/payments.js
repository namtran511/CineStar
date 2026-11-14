import { getDb, getEnv } from "./db";
import { HttpError } from "./http";
import { setAuditActor, setAuditReason } from "./audit-context";
import { paymentConfiguration, verifySePaySignature, validSePayPayload, isSePayTestPayload, settleSePayTransaction } from "./sepay";

export async function receiveSePayWebhook(request) {
    const config = paymentConfiguration(getEnv());
    if (!config.configured) throw new HttpError(503, "Thanh toán SePay chưa được cấu hình.");
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Webhook yêu cầu JSON.");
    if (Number(request.headers.get("content-length")) > 32768) throw new HttpError(413, "Dữ liệu quá lớn.");
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, "Thiếu dữ liệu giao dịch.");
    const chunks = [];
    let size = 0;
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32768) { await reader.cancel(); throw new HttpError(413, "Dữ liệu quá lớn."); }
        chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    let raw;
    try { raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch { throw new HttpError(400, "Dữ liệu UTF-8 không hợp lệ."); }
    if (!await verifySePaySignature(raw, request.headers, config.secret)) throw new HttpError(401, "Chữ ký SePay không hợp lệ hoặc đã hết hạn.");
    let payload;
    try { payload = JSON.parse(raw); } catch { throw new HttpError(400, "Dữ liệu JSON không hợp lệ."); }
    if (isSePayTestPayload(payload)) return Response.json({ success: true, outcome: "test_received" });
    if (!validSePayPayload(payload)) throw new HttpError(400, "Giao dịch SePay không hợp lệ.");
    setAuditActor({ name: "SePay", role: "system" });
    setAuditReason(`Xác nhận giao dịch SePay ${payload.id}`);
    return Response.json(await settleSePayTransaction(await getDb(), config, payload, raw));
}
