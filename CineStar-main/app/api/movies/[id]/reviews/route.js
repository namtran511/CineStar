import { getUser, requireUser } from "@/lib/server/auth";
import { api, jsonBody } from "@/lib/server/http";
import { createMovieReview, getMovieReviews } from "@/lib/server/reviews";

export const GET = api(async (request, context) => {
    const { id } = await context.params;
    const offset = new URL(request.url).searchParams.get("offset") ?? "0";
    return Response.json(await getMovieReviews(id, await getUser(request), offset));
});

export const POST = api(async (request, context) => {
    const user = await requireUser(request, ["user"]);
    const { id } = await context.params;
    return Response.json(await createMovieReview(id, user, await jsonBody(request)), { status: 201 });
});
