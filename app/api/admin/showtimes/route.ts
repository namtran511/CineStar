import { requireUser } from "@/lib/server/auth";
import { listResource, saveResource } from "@/lib/server/admin";
import { api, jsonBody } from "@/lib/server/http";
export const GET = api(async request => { await requireUser(request, ["admin"]); return Response.json({ showtimes: await listResource("showtimes") }); });
export const POST = api(async request => { await requireUser(request, ["admin"]); return Response.json({ showtime: await saveResource("showtimes", await jsonBody(request)) }, { status: 201 }); });
