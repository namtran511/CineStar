import { requireUser } from "@/lib/server/auth";
import { fulfillMembershipReward } from "@/lib/server/membership";
import { api, jsonBody } from "@/lib/server/http";
export const PATCH = api(async (request, context) => Response.json({ reward: await fulfillMembershipReward(await requireUser(request, ["admin", "staff"]), (await context.params).id, await jsonBody(request)) }));
