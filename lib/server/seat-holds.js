import { getDb } from "./db";
import { HttpError, stringField } from "./http";
import { expirePendingPayments } from "./sepay";

const HOLD_DURATION_MS = 10 * 60 * 1000;
export function seatHoldToken(value) {
    const token = stringField(value, "Mã giữ ghế", 36, 36);
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(token))
        throw new HttpError(400, "Mã giữ ghế không hợp lệ.");
    return token;
}

async function screening(db, id, forSale = false) {
    const show = await db.prepare("SELECT s.start_time,r.rows,r.cols FROM showtimes s JOIN rooms r ON r.id=s.room_id WHERE s.id=?").bind(id).first();
    if (!show) throw new HttpError(404, "Suất chiếu không tồn tại.");
    if (forSale && Date.parse(show.start_time) <= Date.now() + 10 * 60000)
        throw new HttpError(400, "Suất chiếu đã bắt đầu hoặc còn dưới 10 phút.");
    return show;
}

export async function seatSnapshot(showtimeId, user = null, token = null) {
    const db = await getDb();
    await expirePendingPayments(db);
    await screening(db, showtimeId);
    // One SELECT gives a consistent view of sold seats and active holds.
    const now = Date.now();
    const rows = await db.prepare(`SELECT seat,'occupied' AS state,NULL AS expires_at FROM booked_seats WHERE showtime_id=?
        UNION ALL SELECT h.seat,CASE WHEN s.user_id=? AND s.id=? THEN 'selected' ELSE 'held' END,s.expires_at
        FROM seat_holds h JOIN seat_hold_sessions s ON s.id=h.hold_token
        WHERE h.showtime_id=? AND s.expires_at>?`).bind(showtimeId, user?.id || "", token || "", showtimeId, now).all();
    const result = { occupied: [], held: [], selected: [], expiresAt: null, serverNow: now };
    for (const row of rows.results) {
        result[row.state].push(row.seat);
        if (row.state === "selected") result.expiresAt = row.expires_at;
    }
    return result;
}

export async function replaceSeatHold(user, showtimeId, body) {
    const token = seatHoldToken(body.holdToken);
    const seats = body.seats;
    if (!Array.isArray(seats) || seats.length > 8 || !seats.every(seat => typeof seat === "string") || new Set(seats).size !== seats.length)
        throw new HttpError(400, "Chọn tối đa 8 ghế khác nhau mỗi đơn.");
    if (!seats.length) return releaseSeatHold(user, showtimeId, token);
    const db = await getDb();
    await expirePendingPayments(db);
    const show = await screening(db, showtimeId, true);
    for (const seat of seats) {
        const match = /^([A-Z])([1-9]\d?)$/.exec(seat);
        if (!match || match[1].charCodeAt(0) - 65 >= show.rows || Number(match[2]) > show.cols)
            throw new HttpError(400, `Ghế ${seat} không hợp lệ.`);
    }
    const now = Date.now();
    const statements = [
        db.prepare("DELETE FROM seat_hold_sessions WHERE expires_at<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)"),
        // Preserve the first deadline on every edit. A token cannot change owner or screening.
        db.prepare(`INSERT INTO seat_hold_sessions (id,user_id,showtime_id,created_at,expires_at) VALUES (?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET user_id=CASE WHEN user_id=excluded.user_id AND showtime_id=excluded.showtime_id THEN user_id ELSE NULL END`).bind(token, user.id, showtimeId, now, Math.min(now + HOLD_DURATION_MS, Date.parse(show.start_time) - 10 * 60000)),
        db.prepare("DELETE FROM seat_holds WHERE hold_token=?").bind(token),
        ...seats.map(seat => db.prepare("INSERT INTO seat_holds (id,hold_token,showtime_id,seat) VALUES (?,?,?,?)").bind(crypto.randomUUID(), token, showtimeId, seat)),
    ];
    try { await db.batch(statements); }
    catch (error) {
        if (/UNIQUE|NOT NULL|CHECK constraint|seat_hold_/i.test(String(error)))
            throw new HttpError(409, "Ghế vừa được người khác giữ/đặt hoặc lượt giữ đã hết hạn. Vui lòng chọn lại.");
        throw error;
    }
    return seatSnapshot(showtimeId, user, token);
}

export async function releaseSeatHold(user, showtimeId, token) {
    const db = await getDb();
    await db.prepare("DELETE FROM seat_hold_sessions WHERE id=? AND user_id=? AND showtime_id=?").bind(token, user.id, showtimeId).run();
    return seatSnapshot(showtimeId, user, token);
}
