import { requireUser } from "@/lib/server/auth";
import { listMembershipRewards } from "@/lib/server/membership";
import { api } from "@/lib/server/http";
export const GET = api(async request => Response.json({ rewards: await listMembershipRewards(await requireUser(request, ["admin", "staff"])) }));
