import { requireUser } from "@/lib/server/auth";
import { redeemMembershipReward } from "@/lib/server/membership";
import { api, jsonBody } from "@/lib/server/http";
export const POST = api(async request => Response.json(await redeemMembershipReward(await requireUser(request, ["user"]), await jsonBody(request)), { status: 201 }));
