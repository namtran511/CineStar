import { getDb } from './db';
import { HttpError } from './http';
import { analyticsPeriod, change, joinTimeline } from '../analytics-rules.js';
import { membershipCardNumber, membershipTier } from '../membership-rules.js';
const valid = "b.status IN ('paid','checked_in')";
const count = 'json_array_length(b.seats)';
const window = 'b.created_at>=? AND b.created_at<?';
export async function getAnalytics(params, now=Date.now()) {
    let period; try { period=analyticsPeriod(params,now); } catch(error) { throw new HttpError(400,error.message); }
    const db=await getDb();
    const key=period.group==='month'?"strftime('%Y-%m',b.created_at,'+7 hours')":period.group==='hour'?"strftime('%H',b.created_at,'+7 hours')":"date(b.created_at,'+7 hours')";
    const queries=[
        `SELECT COALESCE(SUM(CASE WHEN ${valid} THEN b.total ELSE 0 END),0) revenue,COALESCE(SUM(CASE WHEN ${valid} THEN ${count} ELSE 0 END),0) tickets,COALESCE(SUM(CASE WHEN ${valid} THEN 1 ELSE 0 END),0) orders,COALESCE(SUM(CASE WHEN b.status='cancelled' THEN 1 ELSE 0 END),0) cancelled,COUNT(*) allOrders FROM bookings b WHERE ${window}`,
        `SELECT ${key} key,SUM(b.total) revenue,SUM(${count}) tickets,COUNT(*) orders FROM bookings b WHERE ${window} AND ${valid} GROUP BY key ORDER BY key`,
        `SELECT m.id,m.title,SUM(b.total) revenue,SUM(${count}) tickets,COUNT(*) orders FROM bookings b JOIN showtimes s ON s.id=b.showtime_id JOIN movies m ON m.id=s.movie_id WHERE ${window} AND ${valid} GROUP BY m.id,m.title ORDER BY revenue DESC,tickets DESC,m.id`,
        `SELECT b.status key,COUNT(*) orders,SUM(${count}) tickets, SUM(b.total) amount FROM bookings b WHERE ${window} GROUP BY b.status`,
        `SELECT b.payment_method key,SUM(b.total) revenue,SUM(${count}) tickets,COUNT(*) orders FROM bookings b WHERE ${window} AND ${valid} GROUP BY b.payment_method ORDER BY revenue DESC,b.payment_method`,
        `SELECT strftime('%w',b.created_at,'+7 hours') key,SUM(b.total) revenue,SUM(${count}) tickets,COUNT(*) orders FROM bookings b WHERE ${window} AND ${valid} GROUP BY key`,
        `SELECT u.id,u.name,u.points,u.lifetime_points,SUM(b.total) spending,SUM(${count}) tickets,COUNT(*) orders,SUM(b.points_earned) earned FROM bookings b JOIN users u ON u.id=b.user_id WHERE ${window} AND ${valid} AND u.role='user' AND u.deleted_at IS NULL GROUP BY u.id,u.name,u.points,u.lifetime_points ORDER BY spending DESC,tickets DESC,u.id`,
    ];
    const rows=await db.batch([
        ...queries.map(sql=>db.prepare(sql).bind(period.start,period.to)),
        ...queries.map(sql=>db.prepare(sql).bind(period.previousStart,period.previousTo)),
        db.prepare("SELECT DISTINCT strftime('%Y',created_at,'+7 hours') year FROM bookings ORDER BY year DESC"),
    ]);
    const data=(offset)=>({totals:rows[offset].results[0],timeline:rows[offset+1].results,movies:rows[offset+2].results,status:rows[offset+3].results,payments:rows[offset+4].results,weekdays:rows[offset+5].results,members:rows[offset+6].results});
    const current=data(0), previous=data(7);
    const movies=current.movies.map(movie=>({...movie,comparison:change(movie.revenue,previous.movies.find(item=>item.id===movie.id)?.revenue||0)}));
    const members=current.members.map((member,index)=>({id:member.id,name:member.name,cardNumber:membershipCardNumber(member.id),rank:index+1,spending:member.spending,tickets:member.tickets,orders:member.orders,earned:member.earned,points:member.points,tier:membershipTier(member.lifetime_points).name,comparison:change(member.spending,previous.members.find(item=>item.id===member.id)?.spending||0)}));
    const weekdayNames=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
    const weekdays=[1,2,3,4,5,6,0].map(key=>({key:String(key),label:weekdayNames[key],revenue:0,tickets:0,orders:0,...current.weekdays.find(item=>item.key===String(key)),previousTickets:previous.weekdays.find(item=>item.key===String(key))?.tickets||0}));
    const comparisons=Object.fromEntries(['revenue','tickets','orders','cancelled'].map(key=>[key,change(current.totals[key],previous.totals[key])]));
    const years=[...new Set([period.year,Number(new Date(now+7*3600000).getUTCFullYear()),...rows[14].results.map(row=>Number(row.year)).filter(year=>year>=1900)])].sort((a,b)=>b-a);
    return {generatedAt:new Date(now).toISOString(),period,years,totals:current.totals,previousTotals:previous.totals,comparisons,timeline:joinTimeline(period,current.timeline,previous.timeline),movies,status:current.status,payments:current.payments,weekdays,members,previous:{movies:previous.movies,status:previous.status,payments:previous.payments,memberCount:previous.members.length,memberSpending:previous.members.reduce((n,m)=>n+m.spending,0)},definition:'Theo ngày đặt vé, giờ Việt Nam. Doanh thu là số tiền thực trả của đơn đã thanh toán/đã soát vé, gồm combo và sau ưu đãi; không gồm đơn hủy. Vé là số ghế, không phải số đơn. Dữ liệu thanh toán mô phỏng.',memberDefinition:'Xếp hạng thành viên đang hoạt động theo chi tiêu trong kỳ, sau đó theo số vé. Điểm khả dụng và hạng là số hiện tại; điểm từ vé kỳ này chỉ được cộng khi soát vé.'};
}
