import { MEMBERSHIP_REWARDS, MEMBERSHIP_RULES, birthdayWindow, membershipCardNumber, membershipTier, validateBirthDate } from "../membership-rules";
import { getDb } from "./db";
import { HttpError, stringField } from "./http";

export function requireMember(user) {
    if (!user) throw new HttpError(401, "Vui lòng đăng nhập để sử dụng thẻ thành viên.");
    if (user.role !== "user") throw new HttpError(403, "Chương trình thành viên dành cho tài khoản khách hàng.");
}
function mapReward(row) {
    return { id: row.id, code: row.code, key: row.reward_key, name: row.name, type: row.type, pointsCost: Number(row.points_cost), status: row.status, createdAt: row.created_at, fulfilledAt: row.fulfilled_at ?? null };
}
export async function getMembership(user) {
    if (!user || user.role !== "user") return null;
    const db = await getDb();
    const [members, rewards, transactions, birthdayClaims] = await db.batch([
        db.prepare("SELECT id,birth_date,points,lifetime_points FROM users WHERE id=? AND role='user' AND deleted_at IS NULL").bind(user.id),
        db.prepare("SELECT * FROM membership_rewards WHERE user_id=? ORDER BY (status='available') DESC,created_at DESC,id DESC LIMIT 200").bind(user.id),
        db.prepare("SELECT id,delta,description,created_at FROM membership_transactions WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100").bind(user.id),
        db.prepare("SELECT birthday_year FROM membership_birthday_claims WHERE user_id=?").bind(user.id),
    ]);
    const member = members.results[0];
    if (!member) throw new HttpError(403, "Tài khoản thành viên không còn hoạt động.");
    const birthday = birthdayWindow(member.birth_date);
    birthday.used = birthdayClaims.results.some(claim => Number(claim.birthday_year) === birthday.year);
    return {
        cardNumber: membershipCardNumber(member.id), points: Number(member.points), lifetimePoints: Number(member.lifetime_points), tier: membershipTier(Number(member.lifetime_points)),
        birthDate: member.birth_date, birthday, rules: MEMBERSHIP_RULES, rewards: MEMBERSHIP_REWARDS,
        redemptions: rewards.results.map(mapReward), transactions: transactions.results.map(row => ({ id: row.id, delta: Number(row.delta), description: row.description, createdAt: row.created_at })),
    };
}
export async function setMemberBirthDate(user, body) {
    requireMember(user);
    if (Object.keys(body).some(key => key !== "birthDate")) throw new HttpError(400, "Chỉ được cập nhật ngày sinh ở mục này.");
    let birthDate;
    try { birthDate = validateBirthDate(body.birthDate); }
    catch (error) { throw new HttpError(400, error.message); }
    const db = await getDb();
    const result = await db.prepare("UPDATE users SET birth_date=? WHERE id=? AND role='user' AND deleted_at IS NULL AND birth_date IS NULL").bind(birthDate, user.id).run();
    if (!result.meta.changes) throw new HttpError(409, "Ngày sinh chỉ được nhập một lần. Vui lòng liên hệ quản trị viên nếu cần sửa.");
    return getMembership(user);
}
export async function redeemMembershipReward(user, body) {
    requireMember(user);
    if (Object.keys(body).some(key => key !== "rewardKey")) throw new HttpError(400, "Dữ liệu đổi quà không hợp lệ.");
    const key = stringField(body.rewardKey, "Phần quà", 1, 80);
    const reward = MEMBERSHIP_REWARDS.find(item => item.key === key);
    if (!reward) throw new HttpError(404, "Phần quà không tồn tại.");
    const db = await getDb();
    const row = await db.prepare("SELECT points FROM users WHERE id=? AND role='user' AND deleted_at IS NULL").bind(user.id).first();
    if (!row) throw new HttpError(403, "Tài khoản thành viên không còn hoạt động.");
    if (Number(row.points) < reward.pointsCost) throw new HttpError(400, "Bạn chưa đủ điểm để đổi phần quà này.");
    const id = crypto.randomUUID(), code = `CVG${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`, now = new Date().toISOString();
    try {
        await db.batch([
            db.prepare("INSERT INTO membership_rewards (id,user_id,reward_key,name,type,points_cost,code,status,created_at) VALUES (?,?,?,?,?,?,?,'available',?)").bind(id, user.id, reward.key, reward.name, reward.type, reward.pointsCost, code, now),
            // The CHECK constraint aborts and rolls back the whole batch if another
            // purchase spent these points, or an admin disabled this member.
            db.prepare("UPDATE users SET points=CASE WHEN role='user' AND deleted_at IS NULL THEN points-? ELSE -1 END WHERE id=?").bind(reward.pointsCost, user.id),
            db.prepare("INSERT INTO membership_transactions (id,user_id,delta,description,event_key,reward_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), user.id, -reward.pointsCost, `Đổi ${reward.name}`, `reward:${id}`, id, now),
        ]);
    } catch (error) {
        if (String(error).includes("CHECK constraint")) throw new HttpError(409, "Số điểm hoặc tài khoản vừa thay đổi. Vui lòng tải lại thẻ thành viên.");
        throw error;
    }
    return { membership: await getMembership(user), reward: mapReward(await db.prepare("SELECT * FROM membership_rewards WHERE id=?").bind(id).first()) };
}
export async function listMembershipRewards(user) {
    if (!["admin", "staff"].includes(user.role)) throw new HttpError(403, "Chỉ nhân viên hoặc quản trị viên được tra cứu quà thành viên.");
    const db = await getDb();
    const rows = await db.prepare("SELECT r.*,u.name AS customer_name,u.email AS customer_email FROM membership_rewards r JOIN users u ON u.id=r.user_id ORDER BY (r.status='available') DESC,r.created_at DESC,r.id DESC LIMIT 300").all();
    return rows.results.map(row => ({ ...mapReward(row), userId: row.user_id, customerName: row.customer_name, customerEmail: row.customer_email }));
}
export async function fulfillMembershipReward(user, id, body) {
    if (!["admin", "staff"].includes(user.role)) throw new HttpError(403, "Chỉ nhân viên hoặc quản trị viên được giao quà thành viên.");
    if (body.action !== "fulfill" || Object.keys(body).some(key => key !== "action")) throw new HttpError(400, "Thao tác quà thành viên không hợp lệ.");
    const db = await getDb();
    const reward = await db.prepare("SELECT * FROM membership_rewards WHERE id=?").bind(id).first();
    if (!reward) throw new HttpError(404, "Mã quà không tồn tại.");
    if (reward.type === "ticket") throw new HttpError(400, "Vé đổi điểm được sử dụng khi khách hàng đặt vé trên website.");
    const result = await db.prepare("UPDATE membership_rewards SET status='fulfilled',fulfilled_at=?,fulfilled_by=? WHERE id=? AND status='available' AND type IN ('gift','combo') AND EXISTS (SELECT 1 FROM users u WHERE u.id=membership_rewards.user_id AND u.deleted_at IS NULL AND u.role='user')").bind(new Date().toISOString(), user.id, id).run();
    if (!result.meta.changes) throw new HttpError(409, "Quà đã được sử dụng hoặc tài khoản thành viên không còn hoạt động.");
    return mapReward(await db.prepare("SELECT * FROM membership_rewards WHERE id=?").bind(id).first());
}
