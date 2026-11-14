import { deliverEmail, emailConfiguration, emailPayload } from './email-delivery.js';
import { vietnamToday } from '../membership-rules.js';

const when = value => new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
const money = value => new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(value);
export function notificationContent(kind, data) {
    const hello = `Xin chào ${data.name},\n\n`;
    const ticket = ['booking','cancel'].includes(kind) ? `\nPhim: ${data.movie}\nSuất chiếu: ${when(data.startTime)}\nPhòng: ${data.room}\nGhế: ${data.seats.join(', ')}\nMã vé: ${data.code}\nTổng giá trị đơn: ${money(data.total)}` : '';
    if (kind === 'booking') return { subject:`Xác nhận đặt vé ${data.code} · CineStar`, text:hello+'Đơn vé của bạn đã được ghi nhận.'+ticket+'\n\nXuất trình mã vé khi đến rạp. Vui lòng kiểm tra giới hạn tuổi của phim.\n'+(data.paymentProvider && data.paymentProvider !== 'demo' ? 'Đơn đã được xác nhận thanh toán hoặc áp dụng vé miễn phí.' : 'Thanh toán trên hệ thống hiện là giả lập, không thu tiền thật.') };
    if (kind === 'cancel') return { subject:`Đã hủy vé ${data.code} · CineStar`, text:hello+'Đơn vé đã được hủy. Mã vé này không còn sử dụng được.'+ticket+`\n\nĐã hoàn ${data.pointsSpent || 0} điểm đã dùng cho đơn. Quyền dùng ưu đãi/vé thưởng được khôi phục theo quy định thành viên.\n`+(data.paymentProvider === 'sepay' ? 'Rạp sẽ đối soát và xử lý hoàn tiền chuyển khoản. Thao tác hủy vé không tự chuyển tiền về tài khoản ngân hàng.' : data.paymentProvider === 'cash' ? 'Liên hệ quầy để xử lý hoàn tiền mặt theo quy định của rạp.' : 'Không phát sinh hoàn tiền chuyển khoản tự động.') };
    if (kind === 'promotion') return { subject:`Ưu đãi ${data.code} tại CineStar`, text:hello+`Bạn có thể sử dụng mã ${data.code} để giảm ${data.discountPercent}% cho đơn từ ${money(data.minTotal)}.\n\nMỗi đơn dùng một loại ưu đãi. Kiểm tra trạng thái mã và điều kiện hiện tại trên website trước khi đặt vé.` };
    if (kind === 'birthday') return { subject:'Chúc mừng sinh nhật bạn! · CineStar', text:hello+'CineStar chúc bạn một tuổi mới thật nhiều niềm vui và những buổi xem phim đáng nhớ!\n\nƯu đãi sinh nhật giảm 20% một đơn trong khoảng 10 ngày trước đến 10 ngày sau sinh nhật. Nếu đã dùng trong kỳ này, ưu đãi không được cấp lại. Mở Thẻ thành viên để xem quyền lợi còn lại.' };
    return { subject:`${data.subject} · CineStar`, text:hello+`Thông báo về ${data.movie}, suất ${when(data.startTime)} tại ${data.room}:\n\n${data.message}` };
}
export async function enqueueBirthdays(db, now = Date.now()) {
    const today = vietnamToday(now), year = today.slice(0,4), monthDay = today.slice(5);
    const hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',hourCycle:'h23'}).format(now));
    if (hour < 8) return;
    const leapFallback = monthDay === '02-28' && new Date(`${year}-02-29T00:00:00Z`).getUTCMonth() !== 1;
    await db.prepare(`INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
        SELECT 'birthday:'||?||':'||id,id,email,'birthday',?,json_object('name',name),? FROM users
        WHERE role='user' AND deleted_at IS NULL AND email_verified_at IS NOT NULL AND email_birthday=1
          AND (substr(birth_date,6)=? OR (?=1 AND substr(birth_date,6)='02-29'))`).bind(year,year,now,monthDay,leapFallback ? 1 : 0).run();
}
async function allowed(db, job) {
    const user = await db.prepare("SELECT * FROM users WHERE id=? AND deleted_at IS NULL AND role='user' AND email_verified_at IS NOT NULL AND email=?").bind(job.user_id,job.recipient).first();
    if (!user || (job.kind === 'promotion' && !user.email_marketing) || (job.kind === 'birthday' && !user.email_birthday)) return null;
    if (job.kind === 'promotion' && !await db.prepare('SELECT id FROM promotions WHERE id=? AND active=1').bind(job.source_id).first()) return null;
    if (job.kind === 'booking' && !await db.prepare("SELECT id FROM bookings WHERE id=? AND status IN ('paid','checked_in')").bind(job.source_id).first()) return null;
    if (job.kind === 'incident' && !await db.prepare("SELECT b.id FROM bookings b JOIN email_incidents i ON i.showtime_id=b.showtime_id WHERE i.id=? AND b.user_id=? AND b.status IN ('paid','checked_in') LIMIT 1").bind(job.source_id,user.id).first()) return null;
    return user;
}
export async function runEmailJobs(env, { now = Date.now(), fetcher = fetch, delay = ms => new Promise(resolve => setTimeout(resolve,ms)), limit = 5 } = {}) {
    if (!emailConfiguration(env).configured || !env.DB) return { configured:false, processed:0 };
    const db = env.DB;
    await enqueueBirthdays(db,now);
    await db.batch([
        db.prepare('DELETE FROM email_challenges WHERE created_at<?').bind(now-86400000),
        db.prepare('DELETE FROM email_rate_limits WHERE expires_at<?').bind(now),
        db.prepare("UPDATE email_outbox SET status='failed',last_error='email_delivery_error',lease_until=0 WHERE status='sending' AND attempts>=5 AND lease_until<=?").bind(now),
        // Resend deduplicates only within 24 hours. Never retry beyond that window.
        db.prepare("UPDATE email_outbox SET status='failed',last_error='retry_window_expired',lease_until=0 WHERE status IN ('pending','sending') AND created_at<? AND lease_until<=?").bind(now-23*3600000,now),
    ]);
    const due = await db.prepare("SELECT id FROM email_outbox WHERE ((status='pending' AND next_attempt<=?) OR (status='sending' AND lease_until<=?)) AND attempts<5 ORDER BY CASE WHEN kind IN ('booking','cancel','incident') THEN 0 ELSE 1 END,created_at,id LIMIT ?").bind(now,now,limit).all();
    let processed = 0;
    for (const item of due.results) {
        const job = await db.prepare("UPDATE email_outbox SET status='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND ((status='pending' AND next_attempt<=?) OR (status='sending' AND lease_until<=?)) AND attempts<5 RETURNING *").bind(now+120000,item.id,now,now).first();
        if (!job) continue;
        const user = await allowed(db,job);
        if (!user) {
            await db.prepare("UPDATE email_outbox SET status='skipped',lease_until=0,last_error='recipient_or_event_changed' WHERE id=?").bind(job.id).run();
            continue;
        }
        try {
            let payload;
            if (job.rendered) payload = JSON.parse(job.rendered);
            else {
                const content = notificationContent(job.kind,JSON.parse(job.data));
                const unsubscribe = ['promotion','birthday'].includes(job.kind) ? new URL(`/email/unsubscribe?token=${user.email_unsubscribe_token}`,env.APP_URL).href : null;
                payload = emailPayload(env,job.recipient,content.subject,content.text,unsubscribe);
                await db.prepare('UPDATE email_outbox SET rendered=? WHERE id=?').bind(JSON.stringify(payload),job.id).run();
            }
            const providerId = await deliverEmail(env,payload,`notification/${job.id}`,fetcher);
            await db.prepare("UPDATE email_outbox SET status='sent',sent_at=?,provider_id=?,lease_until=0,last_error=NULL WHERE id=?").bind(now,providerId,job.id).run();
            processed++;
        } catch (error) {
            const reason = /^email_[a-z0-9_]+$/.test(error.message) ? error.message : 'email_delivery_error';
            const permanent = /^email_provider_(400|401|403|404|409|422)$/.test(reason);
            await db.prepare('UPDATE email_outbox SET status=?,last_error=?,next_attempt=?,lease_until=0 WHERE id=?').bind(permanent || job.attempts>=5 ? 'failed' : 'pending',reason,now+Math.min(3600000,60000*2**job.attempts),job.id).run();
        }
        await delay(550);
    }
    return { configured:true, processed };
}
