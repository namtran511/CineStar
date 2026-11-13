import { requireUser } from '@/lib/server/auth';
import { api, jsonBody } from '@/lib/server/http';
import { createIncident } from '@/lib/server/email';
export const POST = api(async request => Response.json(await createIncident(await requireUser(request,['admin']),await jsonBody(request)),{status:201}));
