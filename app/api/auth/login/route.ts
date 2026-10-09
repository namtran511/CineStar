import type { User } from "@/lib/types";
import { loginResponse } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { verifyPassword } from "@/lib/server/password";
import { api, HttpError, jsonBody, stringField } from "@/lib/server/http";
export const POST = api(async request => {
  const body = await jsonBody(request); const email = stringField(body.email, "Email", 3, 254).toLowerCase(); const password = stringField(body.password, "Mật khẩu", 1, 128);
  const db = await getDb();
  const row = await db.prepare("SELECT id,name,email,role,password_hash FROM users WHERE email = ?").bind(email).first<User & { password_hash: string }>();
  if (!row || !await verifyPassword(password, row.password_hash)) throw new HttpError(401, "Email hoặc mật khẩu không đúng.");
  const { id, name, role } = row;
  return loginResponse(request, { id, name, email: row.email, role });
});
