import { requireUser } from "@/lib/server/auth";
import { createBooking, listBookings } from "@/lib/server/bookings";
import { api, jsonBody } from "@/lib/server/http";
export const GET = api(async request => { const url = new URL(request.url); return Response.json({ bookings: await listBookings(await requireUser(request), url.searchParams.get("q") || url.searchParams.get("code") || "") }); });
export const POST = api(async request => Response.json({ booking: await createBooking(await requireUser(request), await jsonBody(request)) }, { status: 201 }));
