import { requireUser } from '@/lib/server/auth';
import { api, jsonBody } from '@/lib/server/http';
import { emailPreferences, saveEmailPreferences } from '@/lib/server/email';
export const GET = api(async request => Response.json(await emailPreferences(await requireUser(request))));
export const PATCH = api(async request => Response.json(await saveEmailPreferences(await requireUser(request),await jsonBody(request))));
