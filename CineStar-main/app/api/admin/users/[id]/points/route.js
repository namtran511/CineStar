import { requireUser } from '@/lib/server/auth';
import { api,jsonBody } from '@/lib/server/http';
import { grantMemberPoints } from '@/lib/server/member-operations';
export const POST=api(async(request,context)=>Response.json(await grantMemberPoints(await requireUser(request,['admin']),(await context.params).id,await jsonBody(request))));
