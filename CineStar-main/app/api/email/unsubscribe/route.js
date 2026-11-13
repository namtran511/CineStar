import { getDb } from '@/lib/server/db';
import { api, HttpError, jsonBody } from '@/lib/server/http';
export const POST = api(async request => {
    const token = new URL(request.url).searchParams.get('token') || (await jsonBody(request)).token;
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400,'Liên kết không hợp lệ.');
    const result = await (await getDb()).prepare('UPDATE users SET email_marketing=0,email_birthday=0 WHERE email_unsubscribe_token=? AND deleted_at IS NULL').bind(token).run();
    if (!result.meta.changes) throw new HttpError(404,'Liên kết đã hết hiệu lực. Bạn có thể đổi tùy chọn trong tài khoản.');
    return Response.json({ok:true});
});
