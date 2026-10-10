import { requireUser } from '@/lib/server/auth';
import { api } from '@/lib/server/http';
import { getAnalytics } from '@/lib/server/analytics';
import { analyticsWorkbook } from '@/lib/analytics-excel';
export const GET=api(async request=>{await requireUser(request,['admin']);const report=await getAnalytics(new URL(request.url).searchParams);return new Response(analyticsWorkbook(report),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="CineStar-${report.period.year}-${report.period.month||'all'}-${report.period.day||'all'}.xlsx"`}});});
