import { deliverEmail, emailConfiguration, emailPayload } from './email-delivery.js';
import { hashToken, randomToken } from './password.js';

export class EmailVerificationError extends Error {
    constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new EmailVerificationError(status, message); };
async function codeHash(env, id, code) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(env.EMAIL_CODE_SECRET), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
    return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}:${code}`))), x => x.toString(16).padStart(2,'0')).join('');
}
function newCode() {
    let n; do { n = crypto.getRandomValues(new Uint32Array(1))[0]; } while (n >= 4294000000);
    return String(n % 1000000).padStart(6,'0');
}
async function rateLimit(db, key, maximum, now) {
    const bucket = Math.floor(now / 3600000);
    const id = await hashToken(`${key}:${bucket}`);
    const row = await db.prepare('INSERT INTO email_rate_limits(id,count,expires_at) VALUES (?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 WHERE count<? RETURNING count').bind(id,(bucket+1)*3600000,maximum).first();
    if (!row) fail(429,'Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau một giờ.');
}
export async function requestEmailCode(db, env, details, { now = Date.now(), fetcher = fetch, ip = 'local' } = {}) {
    if (!emailConfiguration(env).configured) fail(503,'Dịch vụ email chưa được cấu hình. Vui lòng liên hệ quản trị viên.');
    await rateLimit(db, `email:${details.email}`, 5, now);
    await rateLimit(db, `ip:${ip}`, 30, now);
    if (details.purpose === 'register' && await db.prepare('SELECT id FROM users WHERE email=?').bind(details.email).first()) fail(409,'Email này đã được đăng ký. Vui lòng đăng nhập.');
    const id = randomToken(), code = newCode();
    const record = await db.prepare(`INSERT INTO email_challenges(id,email,purpose,user_id,name,password_hash,birth_date,marketing,birthday,code_hash,expires_at,resend_at,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(email,purpose) DO UPDATE SET id=excluded.id,user_id=excluded.user_id,name=excluded.name,password_hash=excluded.password_hash,
        birth_date=excluded.birth_date,marketing=excluded.marketing,birthday=excluded.birthday,code_hash=excluded.code_hash,expires_at=excluded.expires_at,resend_at=excluded.resend_at,attempts=0,created_at=excluded.created_at
        WHERE email_challenges.resend_at<=? RETURNING id`).bind(id,details.email,details.purpose,details.userId || null,details.name,details.passwordHash || null,details.birthDate || null,details.marketing ? 1 : 0,details.birthday ? 1 : 0,await codeHash(env,id,code),now+600000,now+60000,now,now).first();
    if (!record) fail(429,'Vui lòng chờ 60 giây trước khi yêu cầu mã mới.');
    try {
        await deliverEmail(env,emailPayload(env,details.email,'Mã xác minh email CineStar',`Xin chào ${details.name},\n\nMã xác minh của bạn: ${code}\n\nMã có hiệu lực trong 10 phút và chỉ dùng một lần. Không chia sẻ mã với người khác. Nếu bạn không yêu cầu, hãy bỏ qua email này.`),`verify/${id}`,fetcher);
    } catch {
        await db.prepare('DELETE FROM email_challenges WHERE id=?').bind(id).run();
        fail(503,'Chưa gửi được mã xác minh. Vui lòng thử lại sau hoặc liên hệ quản trị viên.');
    }
    return { challengeId:id, email:details.email, expiresAt:now+600000, resendAt:now+60000 };
}
export async function resendEmailCode(db, env, id, options) {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) fail(400,'Yêu cầu xác minh không hợp lệ.');
    const row = await db.prepare('SELECT * FROM email_challenges WHERE id=?').bind(id).first();
    if (!row || row.created_at < (options?.now ?? Date.now())-86400000) fail(410,'Yêu cầu đã hết hạn. Vui lòng nhập lại thông tin.');
    return requestEmailCode(db,env,{ email:row.email,purpose:row.purpose,userId:row.user_id,name:row.name,passwordHash:row.password_hash,birthDate:row.birth_date,marketing:row.marketing,birthday:row.birthday },options);
}
export async function confirmEmailCode(db, env, id, code, { now = Date.now(), userId = null } = {}) {
    if (!emailConfiguration(env).configured) fail(503,'Dịch vụ email chưa được cấu hình.');
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id) || typeof code !== 'string' || !/^\d{6}$/.test(code)) fail(400,'Nhập đúng mã xác minh gồm 6 chữ số.');
    const row = await db.prepare("UPDATE email_challenges SET attempts=attempts+1 WHERE id=? AND expires_at>? AND attempts<5 AND (purpose='register' OR user_id=?) RETURNING *").bind(id,now,userId).first();
    if (!row) fail(410,'Mã đã hết hạn, đã dùng hoặc nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.');
    if (row.code_hash !== await codeHash(env,id,code)) fail(400,`Mã xác minh không đúng. Còn ${5-row.attempts} lần thử.`);
    const newUserId = row.purpose === 'register' ? crypto.randomUUID() : row.user_id;
    const iso = new Date(now).toISOString(), token = randomToken();
    const condition = 'id=? AND code_hash=? AND expires_at>? AND attempts<=5';
    let results;
    try {
        results = await db.batch([
            row.purpose === 'register'
                ? db.prepare(`INSERT INTO users(id,name,email,password_hash,role,created_at,birth_date,email_verified_at,email_marketing,email_birthday,email_unsubscribe_token)
                    SELECT ?,name,email,password_hash,'user',?,birth_date,?,marketing,birthday,? FROM email_challenges WHERE ${condition}`).bind(newUserId,iso,iso,token,id,row.code_hash,now)
                : db.prepare(`UPDATE users SET email_verified_at=?,email_unsubscribe_token=COALESCE(email_unsubscribe_token,?) WHERE id=? AND email=? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM email_challenges WHERE ${condition})`).bind(iso,token,newUserId,row.email,id,row.code_hash,now),
            db.prepare(`DELETE FROM email_challenges WHERE ${condition}`).bind(id,row.code_hash,now),
        ]);
    } catch (error) {
        if (String(error).includes('UNIQUE')) fail(409,'Email đã được đăng ký. Vui lòng đăng nhập.');
        throw error;
    }
    if (!results[0].meta.changes) fail(410,'Yêu cầu đã được sử dụng hoặc tài khoản đã thay đổi.');
    const user = await db.prepare('SELECT id,name,email,role,birth_date AS birthDate FROM users WHERE id=?').bind(newUserId).first();
    return { user, registered:row.purpose === 'register' };
}
