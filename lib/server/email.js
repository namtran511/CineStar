import { getDb, getEnv } from './db';
import { HttpError, stringField } from './http';
import { emailConfiguration } from './email-delivery';
import { runEmailJobs } from './email-jobs';
export { requestEmailCode, resendEmailCode, confirmEmailCode } from './email-verification';
export const emailRequestOptions = request => ({ ip: request.headers.get('cf-connecting-ip') || 'local' });
export async function emailPreferences(user) {
    const row = await (await getDb()).prepare('SELECT email,email_verified_at,email_marketing,email_birthday FROM users WHERE id=? AND deleted_at IS NULL').bind(user.id).first();
    return { email:row.email, verified:Boolean(row.email_verified_at), marketing:Boolean(row.email_marketing), birthday:Boolean(row.email_birthday) };
}
export async function saveEmailPreferences(user, body) {
    if (typeof body.marketing !== 'boolean' || typeof body.birthday !== 'boolean' || Object.keys(body).some(key => !['marketing','birthday'].includes(key))) throw new HttpError(400,'Tùy chọn email không hợp lệ.');
    await (await getDb()).prepare('UPDATE users SET email_marketing=?,email_birthday=? WHERE id=? AND deleted_at IS NULL').bind(Number(body.marketing),Number(body.birthday),user.id).run();
    return emailPreferences(user);
}
export async function emailOverview() {
    const db = await getDb();
    const [counts,recent] = await Promise.all([
        db.prepare('SELECT status,COUNT(*) AS total FROM email_outbox GROUP BY status').all(),
        db.prepare('SELECT id,kind,recipient,status,attempts,last_error,created_at,sent_at FROM email_outbox ORDER BY created_at DESC,id DESC LIMIT 50').all(),
    ]);
    return { ...emailConfiguration(getEnv()), counts:counts.results,recent:recent.results };
}
export async function createIncident(user, body) {
    const id = stringField(body.requestId,'Mã yêu cầu',36,36);
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new HttpError(400,'Mã yêu cầu không hợp lệ.');
    const showtimeId = stringField(body.showtimeId,'Suất chiếu',1,100);
    const subject = stringField(body.subject,'Tiêu đề',3,150), message = stringField(body.message,'Nội dung',10,3000);
    if (/[\r\n]/.test(subject)) throw new HttpError(400,'Tiêu đề không được xuống dòng.');
    const db = await getDb();
    if (!await db.prepare('SELECT id FROM showtimes WHERE id=?').bind(showtimeId).first()) throw new HttpError(404,'Suất chiếu không tồn tại.');
    const previous = await db.prepare('SELECT * FROM email_incidents WHERE id=?').bind(id).first();
    if (previous && (previous.showtime_id !== showtimeId || previous.subject !== subject || previous.message !== message)) throw new HttpError(409,'Yêu cầu đã được sử dụng. Hãy tạo thông báo mới.');
    await db.batch([
        db.prepare('INSERT OR IGNORE INTO email_incidents(id,showtime_id,subject,message,created_by,created_at) VALUES (?,?,?,?,?,?)').bind(id,showtimeId,subject,message,user.id,Date.now()),
        db.prepare(`INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
          SELECT DISTINCT 'incident:'||i.id||':'||u.id,u.id,u.email,'incident',i.id,
            json_object('name',u.name,'subject',i.subject,'message',i.message,'movie',m.title,'room',r.name,'startTime',s.start_time),i.created_at
          FROM email_incidents i JOIN showtimes s ON s.id=i.showtime_id JOIN movies m ON m.id=s.movie_id JOIN rooms r ON r.id=s.room_id
          JOIN bookings b ON b.showtime_id=s.id JOIN users u ON u.id=b.user_id
          WHERE i.id=? AND b.status IN ('paid','checked_in') AND u.role='user' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL`).bind(id),
    ]);
    const row = await db.prepare("SELECT COUNT(*) AS total FROM email_outbox WHERE source_id=? AND kind='incident'").bind(id).first();
    return { id,queued:row.total };
}
export async function processEmailQueue(body) {
    const db = await getDb();
    if (!emailConfiguration(getEnv()).configured) throw new HttpError(503,'Cần cấu hình dịch vụ email trước khi gửi.');
    if (body.retryId) {
        const result = await db.prepare("UPDATE email_outbox SET status='pending',attempts=0,next_attempt=0,last_error=NULL WHERE id=? AND status='failed' AND created_at>?").bind(stringField(body.retryId,'Mã email',1,200),Date.now()-23*3600000).run();
        if (!result.meta.changes) throw new HttpError(409,'Chỉ thử lại email lỗi trong 23 giờ đầu để tránh gửi trùng.');
    }
    return runEmailJobs(getEnv());
}
