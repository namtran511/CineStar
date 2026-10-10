import { requireUser } from "@/lib/server/auth";
import { getMembership, setMemberBirthDate } from "@/lib/server/membership";
import { api, jsonBody } from "@/lib/server/http";
export const GET = api(async request => Response.json({ membership: await getMembership(await requireUser(request, ["user"])) }));
export const PATCH = api(async request => Response.json({ membership: await setMemberBirthDate(await requireUser(request, ["user"]), await jsonBody(request)) }));
