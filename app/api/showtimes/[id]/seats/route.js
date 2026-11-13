import { getUser, requireUser } from "@/lib/server/auth";
import { api, jsonBody } from "@/lib/server/http";
import { releaseSeatHold, replaceSeatHold, seatHoldToken, seatSnapshot } from "@/lib/server/seat-holds";

export const GET = api(async (request, context) => {
    const { id } = await context.params;
    const token = new URL(request.url).searchParams.get("holdToken");
    return Response.json(await seatSnapshot(id, token ? await getUser(request) : null, token ? seatHoldToken(token) : null));
});
export const PUT = api(async (request, context) => {
    const user = await requireUser(request);
    const { id } = await context.params;
    return Response.json(await replaceSeatHold(user, id, await jsonBody(request)));
});
export const DELETE = api(async (request, context) => {
    const user = await requireUser(request);
    const { id } = await context.params;
    const body = await jsonBody(request);
    return Response.json(await releaseSeatHold(user, id, seatHoldToken(body.holdToken)));
});
