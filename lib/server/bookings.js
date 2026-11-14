import { getDb, getEnv } from "./db";
import { HttpError, stringField } from "./http";
import { mapShowtime } from "./catalog";
import { birthdayWindow, MEMBERSHIP_RULES } from "../membership-rules";
import { seatHoldToken } from "./seat-holds";
import { expirePendingPayments, paymentConfiguration, paymentInstructions } from "./sepay";
const bookingSelect = "SELECT b.*,m.title AS movie_title,r.name AS room_name,s.start_time,u.name AS customer_name FROM bookings b JOIN showtimes s ON s.id=b.showtime_id JOIN movies m ON m.id=s.movie_id JOIN rooms r ON r.id=s.room_id JOIN users u ON u.id=b.user_id";
function mapBooking(row) {
    return { id: String(row.id), userId: String(row.user_id), showtimeId: String(row.showtime_id), seats: JSON.parse(String(row.seats)), combos: JSON.parse(String(row.combos)), total: Number(row.total), code: String(row.code), status: row.status, createdAt: String(row.created_at), movieTitle: String(row.movie_title), roomName: String(row.room_name), startTime: String(row.start_time), customerName: String(row.customer_name), pointsSpent: Number(row.points_spent || 0), pointsEarned: Number(row.points_earned || 0), discountAmount: Number(row.discount_amount || 0), birthdayYear: row.birthday_year, rewardId: row.reward_id, paymentMethod: row.payment_method, paymentProvider: row.payment_provider, expiresAt: row.expires_at, paidAt: row.paid_at, refundStatus: row.refund_status, payment: paymentInstructions(row), serverNow: Date.now() };
}
export async function getBooking(id) { const db = await getDb(); await expirePendingPayments(db); const row = await db.prepare(`${bookingSelect} WHERE b.id=?`).bind(id).first(); return row ? mapBooking(row) : null; }
export async function listBookings(user, query = "") {
    const db = await getDb();
    await expirePendingPayments(db);
    const filters = [];
    const values = [];
    if (user.role === "user") {
        filters.push("b.user_id=?");
        values.push(user.id);
    }
    if (query) {
        let term = query.slice(0, 48);
        while (new TextEncoder().encode(term).length > 48)
            term = term.slice(0, -1);
        filters.push("(b.code LIKE ? OR u.name LIKE ? OR u.email LIKE ?)");
        for (let i = 0; i < 3; i++)
            values.push(`%${term}%`);
    }
    const result = await db.prepare(`${bookingSelect}${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""} ORDER BY b.created_at DESC LIMIT 200`).bind(...values).all();
    return result.results.map(mapBooking);
}
export async function createBooking(user, body) {
    const showtimeId = stringField(body.showtimeId, "Suất chiếu", 1, 100);
    const holdToken = seatHoldToken(body.holdToken);
    if (!Array.isArray(body.seats) || body.seats.length < 1 || body.seats.length > 8 || !body.seats.every(s => typeof s === "string"))
        throw new HttpError(400, "Mỗi đơn cần từ 1 đến 8 ghế.");
    const seats = body.seats;
    if (new Set(seats).size !== seats.length)
        throw new HttpError(400, "Danh sách ghế bị trùng.");
    const db = await getDb();
    await expirePendingPayments(db);
    // A retry after a lost response recovers the existing order for this hold.
    const existing = await db.prepare("SELECT id,showtime_id,seats FROM bookings WHERE seat_hold_token=? AND user_id=? AND payment_provider='sepay'").bind(holdToken, user.id).first();
    if (existing) {
        if (existing.showtime_id !== showtimeId || JSON.stringify([...seats].sort()) !== JSON.stringify(JSON.parse(existing.seats).sort())) throw new HttpError(409, "Lượt giữ ghế này đã tạo đơn. Hãy mở Vé của tôi.");
        return getBooking(existing.id);
    }
    const activeHolds = await db.prepare("SELECT h.seat FROM seat_holds h JOIN seat_hold_sessions s ON s.id=h.hold_token WHERE s.id=? AND s.user_id=? AND s.showtime_id=? AND s.expires_at>?").bind(holdToken, user.id, showtimeId, Date.now()).all();
    if (seats.some(seat => !activeHolds.results.some(held => held.seat === seat)))
        throw new HttpError(409, "Lượt giữ ghế đã hết hạn hoặc không thuộc về bạn. Vui lòng chọn lại ghế.");
    const showtimeRow = await db.prepare("SELECT * FROM showtimes WHERE id=?").bind(showtimeId).first();
    if (!showtimeRow)
        throw new HttpError(404, "Suất chiếu không tồn tại.");
    const showtime = mapShowtime(showtimeRow);
    if (new Date(showtime.startTime).getTime() <= Date.now() + 10 * 60000)
        throw new HttpError(400, "Suất chiếu đã bắt đầu hoặc còn dưới 10 phút.");
    const room = await db.prepare("SELECT * FROM rooms WHERE id=?").bind(showtime.roomId).first();
    if (!room)
        throw new HttpError(404, "Phòng chiếu không tồn tại.");
    for (const seat of seats) {
        const match = /^([A-Z])([1-9]\d?)$/.exec(seat);
        if (!match || match[1].charCodeAt(0) - 65 >= room.rows || Number(match[2]) > room.cols)
            throw new HttpError(400, `Ghế ${seat} không hợp lệ.`);
    }
    if (!Array.isArray(body.combos ?? []) || (body.combos ?? []).length > 10)
        throw new HttpError(400, "Combo không hợp lệ.");
    const selectedCombos = [];
    let total = seats.length * showtime.price;
    for (const raw of (body.combos ?? [])) {
        if (!raw || typeof raw !== "object")
            throw new HttpError(400, "Combo không hợp lệ.");
        const combo = raw;
        const id = stringField(combo.id, "Combo", 1, 100);
        if (!Number.isInteger(combo.qty) || Number(combo.qty) < 1 || Number(combo.qty) > 5 || selectedCombos.some(c => c.id === id))
            throw new HttpError(400, "Số lượng combo cần từ 1 đến 5 và không được trùng.");
        const row = await db.prepare("SELECT price FROM combos WHERE id=?").bind(id).first();
        if (!row)
            throw new HttpError(404, "Combo không tồn tại.");
        total += row.price * Number(combo.qty);
        selectedCombos.push({ id, qty: Number(combo.qty) });
    }
    const subtotal = total;
    const points = body.redeemPoints ?? 0;
    if (!Number.isSafeInteger(points) || points < 0 || (body.useBirthday !== undefined && typeof body.useBirthday !== "boolean")) throw new HttpError(400, "Điểm hoặc ưu đãi sinh nhật không hợp lệ.");
    if (body.rewardId && body.rewardIds !== undefined) throw new HttpError(400, "Chỉ chọn một cách gửi danh sách vé thưởng.");
    const rewardIds = body.rewardIds === undefined ? (body.rewardId ? [stringField(body.rewardId, "Vé thưởng", 1, 100)] : []) : body.rewardIds;
    if (!Array.isArray(rewardIds) || rewardIds.length > seats.length || rewardIds.length > 8 || rewardIds.some(value => typeof value !== "string" || value.length < 1 || value.length > 100) || new Set(rewardIds).size !== rewardIds.length)
        throw new HttpError(400, "Số vé thưởng phải khác nhau và không vượt số ghế đã chọn.");
    const rewardId = rewardIds[0] || null;
    if ([Boolean(body.promotionCode), points > 0, Boolean(body.useBirthday), rewardIds.length > 0].filter(Boolean).length > 1) throw new HttpError(400, "Mỗi đơn chỉ áp dụng một loại ưu đãi.");
    let birthdayYear = null, member = null;
    if (points || body.useBirthday || rewardIds.length) {
        if (user.role !== "user") throw new HttpError(403, "Ưu đãi thành viên chỉ dành cho khách hàng.");
        member = await db.prepare("SELECT points,birth_date FROM users WHERE id=? AND role='user' AND deleted_at IS NULL").bind(user.id).first();
        if (!member) throw new HttpError(403, "Tài khoản thành viên không còn hoạt động.");
        if (points > member.points || points * MEMBERSHIP_RULES.pointValueVnd > Math.floor(subtotal * .3)) throw new HttpError(400, "Điểm không đủ hoặc mức giảm vượt 30% đơn hàng.");
        if (points) total -= points * MEMBERSHIP_RULES.pointValueVnd;
        if (body.useBirthday) {
            const window = birthdayWindow(member.birth_date);
            if (!window.active) throw new HttpError(400, "Chưa trong thời gian ưu đãi sinh nhật.");
            if (await db.prepare("SELECT 1 FROM membership_birthday_claims WHERE user_id=? AND birthday_year=?").bind(user.id, window.year).first()) throw new HttpError(409, "Ưu đãi sinh nhật năm này đã được dùng.");
            birthdayYear = window.year;
            total = Math.round(subtotal * .8);
        }
        if (rewardIds.length) {
            const rewards = await db.prepare(`SELECT COUNT(*) AS total FROM membership_rewards WHERE id IN (${rewardIds.map(() => '?').join(',')}) AND user_id=? AND type='ticket' AND status='available'`).bind(...rewardIds, user.id).first();
            if (Number(rewards.total) !== rewardIds.length) throw new HttpError(400, "Một hoặc nhiều vé thưởng không còn sử dụng được.");
            total -= showtime.price * rewardIds.length;
        }
    }
    if (body.promotionCode) {
        const code = stringField(body.promotionCode, "Mã ưu đãi", 1, 30).toUpperCase();
        const promotion = await db.prepare("SELECT * FROM promotions WHERE code=? AND active=1").bind(code).first();
        if (!promotion)
            throw new HttpError(400, "Mã ưu đãi không tồn tại hoặc đã tắt.");
        if (total < promotion.min_total)
            throw new HttpError(400, `Đơn hàng cần đạt ${promotion.min_total.toLocaleString("vi-VN")}đ để áp dụng mã.`);
        total = Math.round(total * (100 - promotion.discount_percent) / 100);
    }
    const config = paymentConfiguration(getEnv());
    const online = config.mode === "sepay" && user.role === "user";
    const allowedMethods = config.mode === "sepay" ? (online ? ["bank"] : ["cash"]) : ["momo", "bank", "card", ...(user.role !== "user" ? ["cash"] : [])];
    if (!allowedMethods.includes(String(body.paymentMethod)))
        throw new HttpError(400, "Phương thức thanh toán không hợp lệ.");
    if (online && total > 0 && !config.configured) throw new HttpError(503, "Thanh toán chuyển khoản đang được thiết lập. Vui lòng thử lại sau.");
    const pending = online && total > 0;
    const hold = pending ? await db.prepare("SELECT expires_at FROM seat_hold_sessions WHERE id=? AND user_id=?").bind(holdToken, user.id).first() : null;
    if (pending && (!hold || hold.expires_at <= Date.now())) throw new HttpError(409, "Lượt giữ ghế đã hết hạn. Vui lòng chọn lại.");
    const provider = pending ? "sepay" : total === 0 ? "complimentary" : config.mode === "demo" ? "demo" : "cash";
    const destination = pending ? JSON.stringify({ bank: config.bank, account: config.account, accountName: config.accountName }) : null;
    const id = crypto.randomUUID();
    const code = `CV${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
    const now = new Date().toISOString();
    const statements = [db.prepare("INSERT INTO bookings (id,user_id,showtime_id,seats,combos,total,code,status,created_at,payment_method,points_spent,discount_amount,birthday_year,reward_id,seat_hold_token,payment_provider,payment_destination,expires_at,paid_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id, user.id, showtimeId, JSON.stringify(seats), JSON.stringify(selectedCombos), total, code, pending ? "pending" : "paid", now, String(body.paymentMethod), points, subtotal-total, birthdayYear, rewardId, holdToken, provider, destination, pending ? hold.expires_at : null, pending ? null : now)];
    if (member) {
        // Invalidated eligibility or insufficient funds fails the CHECK constraint,
        // rolling back the booking, seat locks and all benefit claims together.
        statements.push(db.prepare("UPDATE users SET points=CASE WHEN role='user' AND deleted_at IS NULL AND birth_date IS ? THEN points-? ELSE -1 END WHERE id=?").bind(member.birth_date, points, user.id));
    }
    if (points) statements.push(db.prepare("INSERT INTO membership_transactions (id,user_id,delta,description,event_key,booking_id,created_at) VALUES (?,?,?,?,?,?,?)").bind(crypto.randomUUID(), user.id, -points, `Dùng điểm đặt vé ${code}`, `spend:${id}`, id, now));
    if (birthdayYear !== null) statements.push(db.prepare("INSERT INTO membership_birthday_claims (user_id,birthday_year,booking_id) VALUES (?,?,?)").bind(user.id, birthdayYear, id));
    for (const selectedRewardId of rewardIds) {
        statements.push(db.prepare("INSERT INTO membership_reward_claims (reward_id,booking_id) VALUES (?,?)").bind(selectedRewardId, id));
        statements.push(db.prepare("UPDATE membership_rewards SET status='used' WHERE id=? AND user_id=? AND type='ticket' AND status='available'").bind(selectedRewardId, user.id));
    }
    for (const seat of seats)
        statements.push(db.prepare("INSERT INTO booked_seats (id,booking_id,showtime_id,seat) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, showtimeId, seat));
    statements.push(db.prepare("DELETE FROM seat_hold_sessions WHERE id=? AND user_id=?").bind(holdToken, user.id));
    try {
        await db.batch(statements);
    }
    catch (error) {
        if (/showtime_cancelled/.test(String(error)))
            throw new HttpError(409, "Suất chiếu đã hủy do sự cố. Vui lòng chọn suất khác.");
        if (/UNIQUE|CHECK constraint|seat_hold_/.test(String(error)))
            throw new HttpError(409, "Ghế, điểm hoặc ưu đãi vừa được sử dụng. Hãy tải lại và kiểm tra đơn hàng.");
        throw error;
    }
    return (await getBooking(id));
}
export async function updateBooking(user, id, action, { incident = false } = {}) {
    const booking = await getBooking(id);
    if (!booking)
        throw new HttpError(404, "Đơn vé không tồn tại.");
    if (user.role === "user" && booking.userId !== user.id)
        throw new HttpError(403, "Bạn không có quyền với đơn vé này.");
    if (action === "cancel" && user.role !== "user" && user.role !== "admin")
        throw new HttpError(403, "Chỉ khách hàng sở hữu vé hoặc quản trị viên được hủy vé.");
    if (booking.status === "pending" && action === "cancel") {
        const result = await (await getDb()).prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND status='pending'").bind(id).run();
        if (!result.meta.changes) throw new HttpError(409, "Trạng thái đơn vừa thay đổi. Hãy tải lại trước khi hủy.");
        return getBooking(id);
    }
    if (booking.status !== "paid" && !(incident && user.role === "admin" && booking.status === "checked_in"))
        throw new HttpError(409, "Chỉ có thể thao tác với vé đã thanh toán và chưa sử dụng.");
    const db = await getDb();
    if (action === "cancel") {
        const cancellable = incident ? "status IN ('paid','checked_in')" : "status='paid'";
        const cancellationMinutes = user.role === "admin" ? 30 : 60;
        if (!incident && new Date(booking.startTime).getTime() < Date.now() + cancellationMinutes * 60000)
            throw new HttpError(400, `Chỉ có thể hủy trước suất chiếu ít nhất ${cancellationMinutes} phút.`);
        // Every previously spent ticket reward is restored and counts as one
        // returned seat. Grant new rewards only for the remaining seats.
        const usedRewards = await db.prepare("SELECT COUNT(*) AS total FROM membership_reward_claims WHERE booking_id=?").bind(id).first();
        const returnedSeats = booking.seats.slice(Number(usedRewards.total));
        const now = new Date().toISOString();
        const results = await db.batch([
            ...returnedSeats.map(seat => db.prepare(`INSERT INTO membership_rewards (id,user_id,reward_key,name,type,points_cost,code,status,created_at) SELECT ?,b.user_id,'movie-ticket','Vé hoàn từ đơn hủy','ticket',0,?,'available',? FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.id=? AND b.${cancellable} AND u.role='user' AND u.deleted_at IS NULL`).bind(`refund:${id}:${seat}`, `CVR${crypto.randomUUID().replaceAll('-', '').toUpperCase()}`, now, id)),
            db.prepare(`INSERT INTO membership_transactions (id,user_id,delta,description,event_key,booking_id,created_at) SELECT ?,user_id,points_spent,?,?,id,? FROM bookings WHERE id=? AND ${cancellable} AND points_spent>0`).bind(crypto.randomUUID(), `Hoàn điểm hủy vé ${booking.code}`, `refund:${id}`, new Date().toISOString(), id),
            db.prepare(`UPDATE users SET points=points+(SELECT points_spent FROM bookings WHERE id=?) WHERE id=? AND EXISTS (SELECT 1 FROM bookings WHERE id=? AND ${cancellable})`).bind(id, booking.userId, id),
            db.prepare(`UPDATE membership_rewards SET status='available' WHERE id IN (SELECT reward_id FROM membership_reward_claims WHERE booking_id=?) AND status='used' AND EXISTS (SELECT 1 FROM bookings WHERE id=? AND ${cancellable})`).bind(id, id),
            db.prepare(`DELETE FROM membership_reward_claims WHERE booking_id=? AND EXISTS (SELECT 1 FROM bookings WHERE id=? AND ${cancellable})`).bind(id, id),
            db.prepare(`DELETE FROM membership_birthday_claims WHERE booking_id=? AND EXISTS (SELECT 1 FROM bookings WHERE id=? AND ${cancellable})`).bind(id, id),
            db.prepare(`DELETE FROM booked_seats WHERE booking_id=? AND EXISTS (SELECT 1 FROM bookings WHERE id=? AND ${cancellable})`).bind(id, id),
            db.prepare(`UPDATE bookings SET status='cancelled',refund_status='none' WHERE id=? AND ${cancellable}`).bind(id),
        ]);
        if (!results.at(-1).meta.changes)
            throw new HttpError(409, "Trạng thái vé vừa thay đổi.");
    }
    else if (action === "checkin") {
        if (user.role === "user")
            throw new HttpError(403, "Chỉ nhân viên hoặc quản trị viên được soát vé.");
        const delta = new Date(booking.startTime).getTime() - Date.now();
        if (delta > 2 * 3600000 || delta < -3 * 3600000)
            throw new HttpError(400, "Soát vé mở từ 2 giờ trước đến 3 giờ sau giờ chiếu.");
        const earned = Math.floor(booking.total / MEMBERSHIP_RULES.earnPerVnd);
        const results = await db.batch([
            db.prepare("INSERT INTO membership_transactions (id,user_id,delta,description,event_key,booking_id,created_at) SELECT ?,b.user_id,?,?,?,b.id,? FROM bookings b JOIN users u ON u.id=b.user_id WHERE b.id=? AND b.status='paid' AND u.role='user' AND u.deleted_at IS NULL AND ?>0").bind(crypto.randomUUID(), earned, `Tích điểm vé ${booking.code}`, `earn:${id}`, new Date().toISOString(), id, earned),
            db.prepare("UPDATE users SET points=points+?,lifetime_points=lifetime_points+? WHERE id=? AND role='user' AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM bookings WHERE id=? AND status='paid')").bind(earned, earned, booking.userId, id),
            db.prepare("UPDATE bookings SET status='checked_in',points_earned=CASE WHEN EXISTS (SELECT 1 FROM users WHERE id=bookings.user_id AND role='user' AND deleted_at IS NULL) THEN ? ELSE 0 END WHERE id=? AND status='paid'").bind(earned, id),
        ]);
        if (!results.at(-1).meta.changes)
            throw new HttpError(409, "Trạng thái vé vừa thay đổi.");
    }
    else
        throw new HttpError(400, "Thao tác không hợp lệ.");
    return (await getBooking(id));
}
