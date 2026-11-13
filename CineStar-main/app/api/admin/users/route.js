import { requireUser } from "@/lib/server/auth";
import { createUser, listUsers } from "@/lib/server/users";
import { api, jsonBody } from "@/lib/server/http";
export const GET = api(async request => { await requireUser(request, ["admin"]); return Response.json({ users: await listUsers() }); });
export const POST = api(async request => { await requireUser(request, ["admin"]); return Response.json({ user: await createUser(await jsonBody(request)) }, { status: 201 }); });
