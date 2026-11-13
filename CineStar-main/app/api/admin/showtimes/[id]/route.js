import { requireUser } from "@/lib/server/auth";
import { deleteResource, saveResource } from "@/lib/server/admin";
import { api, jsonBody } from "@/lib/server/http";
export const PATCH = api(async (request, context) => { await requireUser(request, ["admin"]); const { id } = await context.params; return Response.json({ showtime: await saveResource("showtimes", await jsonBody(request), id) }); });
export const DELETE = api(async (request, context) => { await requireUser(request, ["admin"]); const { id } = await context.params; await deleteResource("showtimes", id); return Response.json({ ok: true }); });
