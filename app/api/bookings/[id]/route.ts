import { requireUser } from "@/lib/server/auth";
import { updateBooking } from "@/lib/server/bookings";
import { api, jsonBody, type RouteContext } from "@/lib/server/http";
export const PATCH = api(async (request, context: RouteContext) => { const { id } = await context.params; const { action } = await jsonBody(request); return Response.json({ booking: await updateBooking(await requireUser(request), id, action) }); });
export const DELETE = api(async (request, context: RouteContext) => { const { id } = await context.params; return Response.json({ booking: await updateBooking(await requireUser(request), id, "cancel") }); });
