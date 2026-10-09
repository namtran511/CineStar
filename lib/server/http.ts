export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") || 0) > 32000) throw new HttpError(413, "Dữ liệu quá lớn.");
  let data: unknown;
  try { data = await request.json(); } catch { throw new HttpError(400, "Dữ liệu JSON không hợp lệ."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new HttpError(400, "Dữ liệu không hợp lệ.");
  return data as Record<string, unknown>;
}
export function api<T extends unknown[]>(handler: (request: Request, ...args: T) => Promise<Response>) {
  return async (request: Request, ...args: T): Promise<Response> => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        const origin = request.headers.get("origin");
        if (origin && new URL(origin).host !== new URL(request.url).host) throw new HttpError(403, "Yêu cầu khác nguồn bị từ chối.");
      }
      const response = await handler(request, ...args);
      response.headers.set("Cache-Control", "no-store");
      response.headers.set("X-Content-Type-Options", "nosniff");
      return response;
    } catch (error) {
      if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
      console.error("Cinema API error", error instanceof Error ? error.message : "Unknown failure");
      return Response.json({ error: "Hệ thống gặp lỗi. Vui lòng thử lại." }, { status: 500 });
    }
  };
}
export type RouteContext = { params: Promise<{ id: string }> | { id: string } };
export function stringField(value: unknown, name: string, min = 1, max = 500): string {
  if (typeof value !== "string" || value.trim().length < min || value.length > max) throw new HttpError(400, `${name} không hợp lệ.`);
  return value.trim();
}
