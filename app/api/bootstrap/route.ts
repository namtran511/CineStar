import { getCatalog } from "@/lib/server/catalog";
import { getUser } from "@/lib/server/auth";
import { getEnv } from "@/lib/server/db";
import { api } from "@/lib/server/http";
export const GET = api(async (request) => { const [catalog, user] = await Promise.all([getCatalog(), getUser(request)]); return Response.json({ ...catalog, user, aiConfigured: Boolean(getEnv().GEMINI_API_KEY) }); });
