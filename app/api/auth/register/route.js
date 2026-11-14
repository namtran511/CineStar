import { getDb, getEnv } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { api, HttpError, jsonBody, stringField } from "@/lib/server/http";
import { checkedBirthDate } from "@/lib/server/users";
import { requestEmailCode, emailRequestOptions } from '@/lib/server/email';
export const POST = api(async (request) => {
    const body = await jsonBody(request);
    const name = stringField(body.name, "Họ tên", 2, 100);
    const email = stringField(body.email, "Email", 3, 254).toLowerCase();
    const password = stringField(body.password, "Mật khẩu", 8, 128);
    const birthDate = checkedBirthDate(body.birthDate);
    if (body.acceptedPolicies !== true)
        throw new HttpError(400, "Bạn cần đồng ý với các chính sách trước khi đăng ký.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new HttpError(400, "Email không hợp lệ.");
    const challenge = await requestEmailCode(await getDb(),getEnv(),{purpose:'register',name,email,passwordHash:await hashPassword(password),birthDate,marketing:true,birthday:true},emailRequestOptions(request));
    return Response.json({verificationRequired:true,...challenge},{status:202});
});
