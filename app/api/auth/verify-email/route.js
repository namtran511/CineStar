import { getDb, getEnv } from '@/lib/server/db';
import { getUser, loginResponse } from '@/lib/server/auth';
import { api, jsonBody } from '@/lib/server/http';
import { confirmEmailCode } from '@/lib/server/email';
export const POST = api(async request => {
    const body = await jsonBody(request), actor = await getUser(request);
    const result = await confirmEmailCode(await getDb(),getEnv(),body.challengeId,body.code,{userId:actor?.id});
    return result.registered ? loginResponse(request,result.user) : Response.json({verified:true});
});
