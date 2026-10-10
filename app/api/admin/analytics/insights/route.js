import { requireUser } from '@/lib/server/auth';
import { api, HttpError, jsonBody } from '@/lib/server/http';
import { getAnalytics } from '@/lib/server/analytics';
import { analyzeReport } from '@/lib/server/analytics-ai';
import { CHARTS } from '@/lib/analytics-rules';
export const POST=api(async request=>{await requireUser(request,['admin']);const body=await jsonBody(request);if(Object.keys(body).some(key=>key!=='chart')||!['all',...Object.keys(CHARTS)].includes(body.chart))throw new HttpError(400,'Chỉ được chọn biểu đồ cần phân tích.');const report=await getAnalytics(new URL(request.url).searchParams);return Response.json({report,...await analyzeReport(report,body.chart)});});
