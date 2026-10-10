import { getDb, getEnv } from "./db";
import { accountAllowed } from "./seed-accounts";
import { hashToken, randomToken } from "./password";
import { HttpError } from "./http";
import { setAuditActor } from './audit-context';
export const SESSION_COOKIE = "cineverse_session";
export function cookieToken(request) {
    const match = request.headers.get("cookie")?.match(/(?:^|;\s*)cineverse_session=([a-f0-9]{64})(?:;|$)/);
    return match?.[1] || null;
}
export async function getUser(request) {
    const token = cookieToken(request);
    if (!token)
        return null;
    const db = await getDb();
    const user = await db.prepare("SELECT u.id,u.name,u.email,u.role,u.birth_date AS birthDate FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ? AND u.deleted_at IS NULL").bind(await hashToken(token), Date.now()).first();
    if (user && !accountAllowed(getEnv(), user.id)) return null;
    setAuditActor(user);
    return user;
}
export async function requireUser(request, roles) {
    const user = await getUser(request);
    if (!user)
        throw new HttpError(401, "Vui lòng đăng nhập để tiếp tục.");
    if (roles && !roles.includes(user.role))
        throw new HttpError(403, "Bạn không có quyền thực hiện thao tác này.");
    return user;
}
function cookie(request, token, maxAge) {
    return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function loginResponse(request, user) {
    const db = await getDb();
    const token = randomToken();
    const old = cookieToken(request);
    const statements = [db.prepare("INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)").bind(await hashToken(token), user.id, Date.now() + 7 * 86400000), db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now())];
    if (old)
        statements.push(db.prepare("DELETE FROM sessions WHERE id = ?").bind(await hashToken(old)));
    await db.batch(statements);
    return Response.json({ user }, { headers: { "Set-Cookie": cookie(request, token, 7 * 86400) } });
}
export async function logoutResponse(request) {
    const token = cookieToken(request);
    if (token) {
        const db = await getDb();
        await db.prepare("DELETE FROM sessions WHERE id = ?").bind(await hashToken(token)).run();
    }
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie(request, "", 0) } });
}
