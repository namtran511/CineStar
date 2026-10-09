import { getDb } from "@/lib/server/db";
import { api, HttpError, type RouteContext } from "@/lib/server/http";
export const GET = api(async (_request, context: RouteContext) => { const { id } = await context.params; const db = await getDb(); if (!await db.prepare("SELECT id FROM showtimes WHERE id=?").bind(id).first()) throw new HttpError(404, "Suất chiếu không tồn tại."); const rows = await db.prepare("SELECT seat FROM booked_seats WHERE showtime_id=?").bind(id).all<{ seat: string }>(); return Response.json({ occupied: rows.results.map(r => r.seat) }); });
