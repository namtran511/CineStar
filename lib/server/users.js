import { z } from "zod";
import { getDb } from "./db";
import { hashPassword } from "./password";
import { HttpError } from "./http";
import { membershipCardNumber, membershipTier, validateBirthDate } from "../membership-rules";

const fields = {
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
    role: z.enum(["user", "staff", "admin"]),
    birthDate: z.string().nullable().optional(),
    password: z.string().min(8).max(128).optional(),
};
const createSchema = z.object({ ...fields, password: fields.password.unwrap() }).strict();
const updateSchema = z.object(fields).partial().strict();
const columns = "id,name,email,role,birth_date,points,lifetime_points,created_at";

function publicUser(row) {
    return {
        id: row.id, name: row.name, email: row.email, role: row.role,
        birthDate: row.birth_date || null, points: Number(row.points || 0),
        lifetimePoints: Number(row.lifetime_points || 0),
        cardNumber: membershipCardNumber(row.id),
        tier: membershipTier(Number(row.lifetime_points || 0)), createdAt: row.created_at,
    };
}

export function checkedBirthDate(value) {
    try { return validateBirthDate(value); }
    catch (error) { throw new HttpError(400, error.message || "Ngày sinh không hợp lệ."); }
}

function parse(schema, body) {
    const result = schema.safeParse(body);
    if (!result.success) throw new HttpError(400, "Kiểm tra họ tên, email, vai trò và mật khẩu (8–128 ký tự). Không được chỉnh sửa điểm thành viên.");
    return result.data;
}

export async function listUsers() {
    const db = await getDb();
    const result = await db.prepare(`SELECT ${columns} FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC,id DESC`).all();
    return result.results.map(publicUser);
}

export async function createUser(body) {
    const data = parse(createSchema, body);
    const birthDate = data.role === "user" || data.birthDate ? checkedBirthDate(data.birthDate) : null;
    const db = await getDb();
    const id = crypto.randomUUID();
    try {
        await db.prepare("INSERT INTO users (id,name,email,password_hash,role,birth_date,created_at) VALUES (?,?,?,?,?,?,?)")
            .bind(id, data.name, data.email, await hashPassword(data.password), data.role, birthDate, new Date().toISOString()).run();
    } catch (error) {
        if (String(error).includes("UNIQUE")) throw new HttpError(409, "Email này đã được đăng ký.");
        throw error;
    }
    return publicUser(await db.prepare(`SELECT ${columns} FROM users WHERE id=?`).bind(id).first());
}

export async function updateUser(id, body) {
    const changes = parse(updateSchema, body);
    if (!Object.keys(changes).length) throw new HttpError(400, "Chưa có thông tin cần thay đổi.");
    const db = await getDb();
    const current = await db.prepare(`SELECT ${columns} FROM users WHERE id=? AND deleted_at IS NULL`).bind(id).first();
    if (!current) throw new HttpError(404, "Tài khoản không tồn tại.");
    const data = { name: current.name, email: current.email, role: current.role, ...changes };
    const birthDate = Object.hasOwn(changes, "birthDate") ? checkedBirthDate(changes.birthDate) : current.birth_date;
    if (data.role === "user" && current.role !== "user" && !birthDate) checkedBirthDate(birthDate);
    const assignments = ["name=?", "email=?", "role=?", "birth_date=?"];
    const values = [data.name, data.email, data.role, birthDate];
    if (data.password) { assignments.push("password_hash=?"); values.push(await hashPassword(data.password)); }
    const revoke = Boolean(data.password || data.email !== current.email || data.role !== current.role);
    try {
        const results = await db.batch([
            db.prepare(`UPDATE users SET ${assignments.join(",")} WHERE id=? AND deleted_at IS NULL AND (?='admin' OR role!='admin' OR (SELECT COUNT(*) FROM users WHERE role='admin' AND deleted_at IS NULL)>1)`)
                .bind(...values, id, data.role),
            ...(revoke ? [db.prepare("DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM users WHERE id=? AND name=? AND email=? AND role=? AND deleted_at IS NULL)").bind(id, id, data.name, data.email, data.role)] : []),
        ]);
        if (!results[0].meta.changes) throw new HttpError(409, "Cần giữ ít nhất một quản trị viên đang hoạt động.");
    } catch (error) {
        if (String(error).includes("UNIQUE")) throw new HttpError(409, "Email này đã được đăng ký.");
        throw error;
    }
    return publicUser(await db.prepare(`SELECT ${columns} FROM users WHERE id=?`).bind(id).first());
}

export async function deleteUser(actor, id) {
    if (actor.id === id) throw new HttpError(409, "Bạn không thể xóa tài khoản đang đăng nhập.");
    const db = await getDb();
    const row = await db.prepare("SELECT id FROM users WHERE id=? AND deleted_at IS NULL").bind(id).first();
    if (!row) throw new HttpError(404, "Tài khoản không tồn tại.");
    const result = await db.batch([
        db.prepare("UPDATE users SET deleted_at=? WHERE id=? AND deleted_at IS NULL AND (role!='admin' OR (SELECT COUNT(*) FROM users WHERE role='admin' AND deleted_at IS NULL)>1)").bind(new Date().toISOString(), id),
        db.prepare("DELETE FROM sessions WHERE user_id=? AND EXISTS (SELECT 1 FROM users WHERE id=? AND deleted_at IS NOT NULL)").bind(id, id),
    ]);
    if (!result[0].meta.changes) throw new HttpError(409, "Cần giữ ít nhất một quản trị viên đang hoạt động.");
}
