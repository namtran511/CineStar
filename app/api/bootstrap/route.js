import { getCatalog } from "@/lib/server/catalog";
import { getUser } from "@/lib/server/auth";
import { getEnv } from "@/lib/server/db";
import { api } from "@/lib/server/http";
import { publicCinemaLocation } from "@/lib/cinema-location";
import { getMembership } from "@/lib/server/membership";
export const GET = api(async (request) => { const [catalog, user] = await Promise.all([getCatalog(), getUser(request)]); return Response.json({ ...catalog, user, membership: await getMembership(user), demoAccountsEnabled: getEnv().APP_ENV !== "production", aiConfigured: Boolean(getEnv().GEMINI_API_KEY), cinema: publicCinemaLocation(getEnv()) }); });
