import { requireUser } from "@/lib/server/auth";
import { api } from "@/lib/server/http";
import { getMyReviews } from "@/lib/server/reviews";

export const GET = api(async request => Response.json(await getMyReviews(await requireUser(request, ["user"]))));
