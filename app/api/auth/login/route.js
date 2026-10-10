import { loginResponse } from "@/lib/server/auth";
import { getDb, getEnv } from "@/lib/server/db";
import { accountAllowed } from "@/lib/server/seed-accounts";
import { verifyPassword } from "@/lib/server/password";
import { api, HttpError, jsonBody, stringField } from "@/lib/server/http";
export const POST = api(async (request) => {
    const body = await jsonBody(request);
    const email = stringField(body.email, "Email", 3, 254).toLowerCase();
    const password = stringField(body.password, "Mật khẩu", 1, 128);
    const db = await getDb();
    const row = await db.prepare("SELECT id,name,email,role,birth_date,password_hash FROM users WHERE email = ? AND deleted_at IS NULL").bind(email).first();
    if (!row || !accountAllowed(getEnv(), row.id) || !await verifyPassword(password, row.password_hash))
        throw new HttpError(401, "Email hoặc mật khẩu không đúng.");
    const { id, name, role } = row;
    return loginResponse(request, { id, name, email: row.email, role, birthDate: row.birth_date || null });
});
