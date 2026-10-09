import { requireUser } from "@/lib/server/auth";
import { patchUser } from "@/lib/server/admin";
import { api, jsonBody, type RouteContext } from "@/lib/server/http";
export const PATCH = api(async (request, context: RouteContext) => { await requireUser(request, ["admin"]); const { id } = await context.params; return Response.json({ user: await patchUser(id, await jsonBody(request)) }); });
