import { requireUser } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { api } from "@/lib/server/http";
export const GET = api(async request => { await requireUser(request, ["admin"]); const db = await getDb(); const result = await db.prepare("SELECT id,name,email,role FROM users ORDER BY created_at DESC").all(); return Response.json({ users: result.results }); });
