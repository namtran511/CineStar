import type { Booking, Room, Showtime, User } from "../types";
import { getDb } from "./db";
import { HttpError, stringField } from "./http";
import { mapShowtime } from "./catalog";

const bookingSelect = "SELECT b.*,m.title AS movie_title,r.name AS room_name,s.start_time,u.name AS customer_name FROM bookings b JOIN showtimes s ON s.id=b.showtime_id JOIN movies m ON m.id=s.movie_id JOIN rooms r ON r.id=s.room_id JOIN users u ON u.id=b.user_id";
function mapBooking(row: Record<string, unknown>): Booking {
  return { id: String(row.id), userId: String(row.user_id), showtimeId: String(row.showtime_id), seats: JSON.parse(String(row.seats)), combos: JSON.parse(String(row.combos)), total: Number(row.total), code: String(row.code), status: row.status as Booking["status"], createdAt: String(row.created_at), movieTitle: String(row.movie_title), roomName: String(row.room_name), startTime: String(row.start_time), customerName: String(row.customer_name), paymentMethod: row.payment_method as Booking["paymentMethod"] };
}
export async function getBooking(id: string): Promise<Booking | null> { const db = await getDb(); const row = await db.prepare(`${bookingSelect} WHERE b.id=?`).bind(id).first(); return row ? mapBooking(row) : null; }
export async function listBookings(user: User, query = ""): Promise<Booking[]> {
  const db = await getDb();
  const filters: string[] = []; const values: string[] = [];
  if (user.role === "user") { filters.push("b.user_id=?"); values.push(user.id); }
  if (query) {
    let term = query.slice(0, 48);
    while (new TextEncoder().encode(term).length > 48) term = term.slice(0, -1);
    filters.push("(b.code LIKE ? OR u.name LIKE ? OR u.email LIKE ?)"); for (let i = 0; i < 3; i++) values.push(`%${term}%`);
  }
  const result = await db.prepare(`${bookingSelect}${filters.length ? ` WHERE ${filters.join(" AND ")}` : ""} ORDER BY b.created_at DESC LIMIT 200`).bind(...values).all();
  return result.results.map(mapBooking);
}
export async function createBooking(user: User, body: Record<string, unknown>): Promise<Booking> {
  const showtimeId = stringField(body.showtimeId, "Suất chiếu", 1, 100);
  if (!Array.isArray(body.seats) || body.seats.length < 1 || body.seats.length > 8 || !body.seats.every(s => typeof s === "string")) throw new HttpError(400, "Mỗi đơn cần từ 1 đến 8 ghế.");
  const seats = body.seats as string[];
  if (new Set(seats).size !== seats.length) throw new HttpError(400, "Danh sách ghế bị trùng.");
  const db = await getDb();
  const showtimeRow = await db.prepare("SELECT * FROM showtimes WHERE id=?").bind(showtimeId).first();
  if (!showtimeRow) throw new HttpError(404, "Suất chiếu không tồn tại.");
  const showtime: Showtime = mapShowtime(showtimeRow);
  if (new Date(showtime.startTime).getTime() <= Date.now() + 10 * 60000) throw new HttpError(400, "Suất chiếu đã bắt đầu hoặc còn dưới 10 phút.");
  const room = await db.prepare("SELECT * FROM rooms WHERE id=?").bind(showtime.roomId).first<Room>();
  if (!room) throw new HttpError(404, "Phòng chiếu không tồn tại.");
  for (const seat of seats) {
    const match = /^([A-Z])([1-9]\d?)$/.exec(seat);
    if (!match || match[1].charCodeAt(0) - 65 >= room.rows || Number(match[2]) > room.cols) throw new HttpError(400, `Ghế ${seat} không hợp lệ.`);
  }
  if (!Array.isArray(body.combos ?? []) || ((body.combos ?? []) as unknown[]).length > 10) throw new HttpError(400, "Combo không hợp lệ.");
  const selectedCombos: { id: string; qty: number }[] = [];
  let total = seats.length * showtime.price;
  for (const raw of (body.combos ?? []) as unknown[]) {
    if (!raw || typeof raw !== "object") throw new HttpError(400, "Combo không hợp lệ.");
    const combo = raw as Record<string, unknown>; const id = stringField(combo.id, "Combo", 1, 100);
    if (!Number.isInteger(combo.qty) || Number(combo.qty) < 1 || Number(combo.qty) > 5 || selectedCombos.some(c => c.id === id)) throw new HttpError(400, "Số lượng combo cần từ 1 đến 5 và không được trùng.");
    const row = await db.prepare("SELECT price FROM combos WHERE id=?").bind(id).first<{ price: number }>();
    if (!row) throw new HttpError(404, "Combo không tồn tại.");
    total += row.price * Number(combo.qty); selectedCombos.push({ id, qty: Number(combo.qty) });
  }
  if (body.promotionCode) {
    const code = stringField(body.promotionCode, "Mã ưu đãi", 1, 30).toUpperCase();
    const promotion = await db.prepare("SELECT * FROM promotions WHERE code=? AND active=1").bind(code).first<{ min_total: number; discount_percent: number }>();
    if (!promotion) throw new HttpError(400, "Mã ưu đãi không tồn tại hoặc đã tắt.");
    if (total < promotion.min_total) throw new HttpError(400, `Đơn hàng cần đạt ${promotion.min_total.toLocaleString("vi-VN")}đ để áp dụng mã.`);
    total = Math.round(total * (100 - promotion.discount_percent) / 100);
  }
  if (!["momo", "bank", "card"].includes(String(body.paymentMethod))) throw new HttpError(400, "Phương thức thanh toán không hợp lệ.");
  const id = crypto.randomUUID(); const code = `CV${crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
  const statements = [db.prepare("INSERT INTO bookings (id,user_id,showtime_id,seats,combos,total,code,status,created_at,payment_method) VALUES (?,?,?,?,?,?,?,'paid',?,?)").bind(id, user.id, showtimeId, JSON.stringify(seats), JSON.stringify(selectedCombos), total, code, new Date().toISOString(), String(body.paymentMethod))];
  for (const seat of seats) statements.push(db.prepare("INSERT INTO booked_seats (id,booking_id,showtime_id,seat) VALUES (?,?,?,?)").bind(crypto.randomUUID(), id, showtimeId, seat));
  try { await db.batch(statements); }
  catch (error) { if (String(error).includes("UNIQUE")) throw new HttpError(409, "Một ghế bạn chọn vừa được đặt. Hãy tải lại và chọn ghế khác."); throw error; }
  return (await getBooking(id))!;
}
export async function updateBooking(user: User, id: string, action: unknown): Promise<Booking> {
  const booking = await getBooking(id);
  if (!booking) throw new HttpError(404, "Đơn vé không tồn tại.");
  if (user.role === "user" && booking.userId !== user.id) throw new HttpError(403, "Bạn không có quyền với đơn vé này.");
  if (booking.status !== "paid") throw new HttpError(409, "Chỉ có thể thao tác với vé đã thanh toán và chưa sử dụng.");
  const db = await getDb();
  if (action === "cancel") {
    if (new Date(booking.startTime).getTime() < Date.now() + 60 * 60000) throw new HttpError(400, "Chỉ có thể hủy trước suất chiếu ít nhất 60 phút.");
    const results = await db.batch([
      db.prepare("DELETE FROM booked_seats WHERE booking_id=? AND EXISTS (SELECT 1 FROM bookings WHERE id=? AND status='paid')").bind(id, id),
      db.prepare("UPDATE bookings SET status='cancelled' WHERE id=? AND status='paid'").bind(id),
    ]);
    if (!results[1].meta.changes) throw new HttpError(409, "Trạng thái vé vừa thay đổi.");
  } else if (action === "checkin") {
    if (user.role === "user") throw new HttpError(403, "Chỉ nhân viên hoặc quản trị viên được soát vé.");
    const delta = new Date(booking.startTime).getTime() - Date.now();
    if (delta > 2 * 3600000 || delta < -3 * 3600000) throw new HttpError(400, "Soát vé mở từ 2 giờ trước đến 3 giờ sau giờ chiếu.");
    const result = await db.prepare("UPDATE bookings SET status='checked_in' WHERE id=? AND status='paid'").bind(id).run();
    if (!result.meta.changes) throw new HttpError(409, "Trạng thái vé vừa thay đổi.");
  } else throw new HttpError(400, "Thao tác không hợp lệ.");
  return (await getBooking(id))!;
}
