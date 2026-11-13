import { requireUser } from '@/lib/server/auth';
import { api, jsonBody } from '@/lib/server/http';
import { emailOverview, processEmailQueue } from '@/lib/server/email';
export const GET = api(async request => { await requireUser(request,['admin']); return Response.json(await emailOverview()); });
export const POST = api(async request => { await requireUser(request,['admin']); return Response.json(await processEmailQueue(await jsonBody(request))); });
