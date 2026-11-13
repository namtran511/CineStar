import { requireUser } from '@/lib/server/auth';
import { api,jsonBody } from '@/lib/server/http';
import { editMemberBirthday } from '@/lib/server/member-operations';
export const PATCH=api(async(request,context)=>Response.json({member:await editMemberBirthday(await requireUser(request,['admin','staff']),(await context.params).id,await jsonBody(request))}));
