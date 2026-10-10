import { requireUser } from "@/lib/server/auth";
import { listResource, saveResource } from "@/lib/server/admin";
import { api, jsonBody } from "@/lib/server/http";
export const GET = api(async (request) => { await requireUser(request, ["admin"]); return Response.json({ rooms: await listResource("rooms") }); });
export const POST = api(async (request) => { await requireUser(request, ["admin"]); return Response.json({ room: await saveResource("rooms", await jsonBody(request)) }, { status: 201 }); });
