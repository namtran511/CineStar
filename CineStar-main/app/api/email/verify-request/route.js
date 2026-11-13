import { requireUser } from '@/lib/server/auth';
import { getDb, getEnv } from '@/lib/server/db';
import { api } from '@/lib/server/http';
import { requestEmailCode, emailRequestOptions } from '@/lib/server/email';
export const POST = api(async request => {
    const user = await requireUser(request);
    return Response.json(await requestEmailCode(await getDb(),getEnv(),{purpose:'verify',userId:user.id,name:user.name,email:user.email},emailRequestOptions(request)),{status:202});
});
