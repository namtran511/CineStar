import { loginResponse } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { hashPassword } from "@/lib/server/password";
import { api, HttpError, jsonBody, stringField } from "@/lib/server/http";
export const POST = api(async request => {
  const body = await jsonBody(request); const name = stringField(body.name, "Họ tên", 2, 100); const email = stringField(body.email, "Email", 3, 254).toLowerCase(); const password = stringField(body.password, "Mật khẩu", 8, 128);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Email không hợp lệ.");
  const db = await getDb();
  const user = { id: crypto.randomUUID(), name, email, role: "user" as const };
  try { await db.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)").bind(user.id, name, email, await hashPassword(password), "user", new Date().toISOString()).run(); }
  catch (error) { if (String(error).includes("UNIQUE")) throw new HttpError(409, "Email này đã được đăng ký."); throw error; }
  return loginResponse(request, user);
});
