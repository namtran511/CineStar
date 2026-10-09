import type { Role, User } from "../types";
import { getDb } from "./db";
import { hashToken, randomToken } from "./password";
import { HttpError } from "./http";

export const SESSION_COOKIE = "cineverse_session";
export function cookieToken(request: Request) {
  const match = request.headers.get("cookie")?.match(/(?:^|;\s*)cineverse_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] || null;
}
export async function getUser(request: Request): Promise<User | null> {
  const token = cookieToken(request);
  if (!token) return null;
  const db = await getDb();
  return db.prepare("SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?").bind(await hashToken(token), Date.now()).first<User>();
}
export async function requireUser(request: Request, roles?: Role[]): Promise<User> {
  const user = await getUser(request);
  if (!user) throw new HttpError(401, "Vui lòng đăng nhập để tiếp tục.");
  if (roles && !roles.includes(user.role)) throw new HttpError(403, "Bạn không có quyền thực hiện thao tác này.");
  return user;
}
function cookie(request: Request, token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
export async function loginResponse(request: Request, user: User) {
  const db = await getDb();
  const token = randomToken();
  const old = cookieToken(request);
  const statements = [db.prepare("INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)").bind(await hashToken(token), user.id, Date.now() + 7 * 86400000), db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(Date.now())];
  if (old) statements.push(db.prepare("DELETE FROM sessions WHERE id = ?").bind(await hashToken(old)));
  await db.batch(statements);
  return Response.json({ user }, { headers: { "Set-Cookie": cookie(request, token, 7 * 86400) } });
}
export async function logoutResponse(request: Request) {
  const token = cookieToken(request);
  if (token) { const db = await getDb(); await db.prepare("DELETE FROM sessions WHERE id = ?").bind(await hashToken(token)).run(); }
  return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie(request, "", 0) } });
}
