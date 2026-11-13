import { requireUser } from "@/lib/server/auth";
import { updateUser, deleteUser } from "@/lib/server/users";
import { api, jsonBody } from "@/lib/server/http";
export const PATCH = api(async (request, context) => { await requireUser(request, ["admin"]); const { id } = await context.params; return Response.json({ user: await updateUser(id, await jsonBody(request)) }); });
export const DELETE = api(async (request, context) => { const actor = await requireUser(request, ["admin"]); const { id } = await context.params; await deleteUser(actor, id); return Response.json({ ok: true }); });
