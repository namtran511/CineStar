import { auditScope, setAuditReason } from './audit-context';
export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export async function jsonBody(request) {
    if (Number(request.headers.get("content-length") || 0) > 32000)
        throw new HttpError(413, "Dữ liệu quá lớn.");
    let data;
    try {
        data = await request.json();
    }
    catch {
        throw new HttpError(400, "Dữ liệu JSON không hợp lệ.");
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
        throw new HttpError(400, "Dữ liệu không hợp lệ.");
    setAuditReason(data.reason);
    return data;
}
export function api(handler) {
    return async (request, ...args) => {
        try {
            if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
                const origin = request.headers.get("origin");
                if (origin && new URL(origin).host !== new URL(request.url).host)
                    throw new HttpError(403, "Yêu cầu khác nguồn bị từ chối.");
            }
            const response = await auditScope.run({id:crypto.randomUUID(),operation:`${request.method} ${new URL(request.url).pathname}`.slice(0,400)},()=>handler(request, ...args));
            response.headers.set("Cache-Control", "no-store");
            response.headers.set("X-Content-Type-Options", "nosniff");
            return response;
        }
        catch (error) {
            if (error instanceof HttpError)
                return Response.json({ error: error.message }, { status: error.status });
            console.error("Cinema API error", error instanceof Error ? error.message : "Unknown failure");
            return Response.json({ error: "Hệ thống gặp lỗi. Vui lòng thử lại." }, { status: 500 });
        }
    };
}
export function stringField(value, name, min = 1, max = 500) {
    if (typeof value !== "string" || value.trim().length < min || value.length > max)
        throw new HttpError(400, `${name} không hợp lệ.`);
    return value.trim();
}
