import { requireUser } from "@/lib/server/auth";
import { getSummary } from "@/lib/server/admin";
import { api } from "@/lib/server/http";
export const GET = api(async request => Response.json(await getSummary(await requireUser(request, ["admin"]))));
