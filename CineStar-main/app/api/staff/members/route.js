import { requireUser } from '@/lib/server/auth';
import { api } from '@/lib/server/http';
import { findMembers } from '@/lib/server/member-operations';
export const GET=api(async request=>{await requireUser(request,['admin','staff']);return Response.json({members:await findMembers(new URL(request.url).searchParams.get('q')||'')});});
