import { requireUser } from "@/lib/server/auth";
import { listResource, saveResource } from "@/lib/server/admin";
import { api, jsonBody } from "@/lib/server/http";
export const GET = api(async request => { await requireUser(request, ["admin"]); return Response.json({ movies: await listResource("movies") }); });
export const POST = api(async request => { await requireUser(request, ["admin"]); return Response.json({ movie: await saveResource("movies", await jsonBody(request)) }, { status: 201 }); });
