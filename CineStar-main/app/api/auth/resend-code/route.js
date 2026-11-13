import { getDb, getEnv } from '@/lib/server/db';
import { api, jsonBody } from '@/lib/server/http';
import { resendEmailCode, emailRequestOptions } from '@/lib/server/email';
export const POST = api(async request => {
    const body = await jsonBody(request);
    return Response.json(await resendEmailCode(await getDb(),getEnv(),body.challengeId,emailRequestOptions(request)),{status:202});
});
