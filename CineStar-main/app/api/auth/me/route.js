import { getUser } from "@/lib/server/auth";
import { api } from "@/lib/server/http";
export const GET = api(async (request) => Response.json({ user: await getUser(request) }));
