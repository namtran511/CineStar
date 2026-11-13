import { vietnamToday } from './membership-rules.js';
const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');
const localStart = (year, month = 1, day = 1) => Date.UTC(year, month - 1, day) - 7 * 3600000;
export const CHARTS = Object.freeze({ revenue: 'Doanh thu theo thời gian', tickets: 'Vé bán theo thời gian', movies: 'Phim nổi bật', status: 'Trạng thái đơn vé', payments: 'Phương thức thanh toán', weekdays: 'Nhịp đặt vé trong tuần', members: 'Bảng xếp hạng thành viên' });
export function analyticsPeriod(params, now = Date.now()) {
    const today = vietnamToday(now), currentYear = Number(today.slice(0,4));
    const number = (key, fallback) => { const raw = params.get(key); if (raw === null || raw === '') return fallback; if (!/^\d+$/.test(raw)) throw new Error('Bộ lọc thời gian không hợp lệ.'); return Number(raw); };
    for (const key of params.keys()) if (!['year','month','day','group'].includes(key)) throw new Error('Bộ lọc không được hỗ trợ.');
    const year = number('year', currentYear), month = number('month', 0), day = number('day', 0);
    if (year < 1900 || year > currentYear + 1 || month < 0 || month > 12 || day < 0 || day > 31 || (day && !month) || (day && new Date(Date.UTC(year,month-1,day)).getUTCMonth() !== month-1)) throw new Error('Năm, tháng hoặc ngày không hợp lệ.');
    const unit = day ? 'day' : month ? 'month' : 'year';
    const group = day ? 'hour' : params.get('group') || (month ? 'day' : 'month');
    if (!['month','day','hour'].includes(group) || (group === 'hour' && !day) || (group === 'month' && month)) throw new Error('Cách nhóm thời gian không hợp lệ.');
    const start = localStart(year,month||1,day||1);
    const end = unit === 'day' ? start + DAY : unit === 'month' ? localStart(year,month+1) : localStart(year+1);
    const prevStart = unit === 'day' ? start - DAY : unit === 'month' ? localStart(year,month-1) : localStart(year-1);
    const ongoing = start <= now && now < end;
    const future = start > now;
    const to = future ? start : ongoing ? now : end;
    // Compare the same elapsed duration; cap at the previous period's boundary.
    const previousTo = future ? prevStart : ongoing ? Math.min(start,prevStart+(to-start)) : start;
    const label = day ? `${pad(day)}/${pad(month)}/${year}` : month ? `Tháng ${month}/${year}` : `Năm ${year}`;
    const previousDate = new Date(prevStart + 7*3600000);
    const previousLabel = day ? `${pad(previousDate.getUTCDate())}/${pad(previousDate.getUTCMonth()+1)}/${previousDate.getUTCFullYear()}` : month ? `Tháng ${previousDate.getUTCMonth()+1}/${previousDate.getUTCFullYear()}` : `Năm ${year-1}`;
    return { year,month,day,unit,group,label,previousLabel,ongoing,future,start:new Date(start).toISOString(),end:new Date(end).toISOString(),to:new Date(to).toISOString(),previousStart:new Date(prevStart).toISOString(),previousTo:new Date(previousTo).toISOString(),comparisonNote:ongoing?'So sánh cùng thời lượng đã trôi qua, tối đa đến hết kỳ trước.':future?'Kỳ tương lai chưa có số liệu.':'So sánh hai kỳ đã kết thúc.' };
}
export function change(current, previous) { return { current, previous, difference:current-previous, percent:previous ? Math.round((current-previous)/previous*1000)/10 : null, direction:current>previous?'up':current<previous?'down':'flat' }; }
export function timelineKeys(period, previous=false) {
    const start=Date.parse(previous?period.previousStart:period.start), end=Date.parse(previous?period.start:period.end), keys=[];
    if(period.group==='month') {const year=vietnamToday(start).slice(0,4);return Array.from({length:12},(_,i)=>`${year}-${pad(i+1)}`);}
    if(period.group==='hour') return Array.from({length:24},(_,i)=>pad(i));
    for(let time=start;time<end;time+=DAY) keys.push(vietnamToday(time));
    return keys;
}
export function joinTimeline(period,current,previous) {
    const keys=timelineKeys(period), beforeKeys=timelineKeys(period,true), map=new Map(current.map(row=>[row.key,row])), before=new Map(previous.map(row=>[row.key,row]));
    // Keep extra days of the previous month/year visible instead of silently
    // dropping revenue when comparing periods with different day counts.
    return Array.from({length:Math.max(keys.length,beforeKeys.length)},(_,index)=>{
        const key=keys[index], previousKey=beforeKeys[index];
        return {key:key||`previous:${previousKey}`,previousKey:previousKey||null,label:!key?`Kỳ trước ${previousKey.slice(8)}`:period.group==='month'?`T${index+1}`:period.group==='hour'?`${key}h`:key.slice(5).split('-').reverse().join('/'),revenue:map.get(key)?.revenue||0,tickets:map.get(key)?.tickets||0,orders:map.get(key)?.orders||0,previousRevenue:before.get(previousKey)?.revenue||0,previousTickets:before.get(previousKey)?.tickets||0};
    });
}
