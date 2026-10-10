import { requireUser } from '@/lib/server/auth';
import { api } from '@/lib/server/http';
import { getAnalytics } from '@/lib/server/analytics';
export const GET=api(async request=>{await requireUser(request,['admin']);return Response.json(await getAnalytics(new URL(request.url).searchParams));});
