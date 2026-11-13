import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
const base = new URL(process.argv.find(arg => /^https?:\/\//.test(arg)) || "http://localhost:5173");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) throw new Error("Local test server required.");
const ids = { user: "", movie: "", room: "", shows: [] };
let assertions = 0;
function check(condition, message) { assert.ok(condition, message); assertions++; console.log(`✓ ${message}`); }
async function call(path, method = "GET", body, cookie = "") {
  const response = await fetch(new URL(path, base), { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
async function login(email) { const result = await call("/api/auth/login", "POST", { email, password: "Demo@123" }); assert.equal(result.status, 200); return result.cookie; }
try {
  const admin = await login("admin@cineverse.vn"); const staff = await login("staff@cineverse.vn");
  const baseline = (await call("/api/admin/summary", "GET", undefined, admin)).body;
  const own = await call("/api/auth/register", "POST", { name: "Smoke Checkin", email: `smoke-checkin-${Date.now()}@cineverse.test`, password: "SmokeTest@123", birthDate: "2000-01-15" });
  assert.equal(own.status, 200); ids.user = own.body.user.id;
  const catalog = (await call("/api/bootstrap")).body;
  const { rating: _rating, reviewCount: _reviewCount, ...movieFields } = catalog.movies.find(m => m.status === "now");
  const movie = await call("/api/admin/movies", "POST", { ...movieFields, id: undefined, title: `Smoke Checkin ${Date.now()}`, duration: 90 }, admin);
  assert.equal(movie.status, 201); ids.movie = movie.body.movie.id;
  const room = await call("/api/admin/rooms", "POST", { name: `Smoke Checkin ${Date.now()}`, rows: 2, cols: 4, type: "Standard" }, admin);
  assert.equal(room.status, 201); ids.room = room.body.room.id;
  for (const minutes of [90, 210]) {
    const show = await call("/api/admin/showtimes", "POST", { movieId: ids.movie, roomId: ids.room, startTime: new Date(Date.now() + minutes * 60000).toISOString(), price: 44000, format: "2D · Test" }, admin);
    assert.equal(show.status, 201); ids.shows.push(show.body.showtime.id);
  }
  check((await call(`/api/admin/movies/${ids.movie}`, "PATCH", { duration: 130 }, admin)).status === 409, "Sửa thời lượng không được tạo lịch trùng phòng");
  check((await call(`/api/admin/movies/${ids.movie}`, "PATCH", { status: "coming" }, admin)).status === 409, "Phim có suất tương lai không chuyển sang sắp chiếu");
  check((await call(`/api/admin/movies/${ids.movie}`, "PATCH", { description: "Mô tả mới của phim kiểm thử vẫn được cập nhật." }, admin)).status === 200, "Thông tin phim còn có thể cập nhật khi không ảnh hưởng lịch");
  const holdToken = randomUUID();
  assert.equal((await call(`/api/showtimes/${ids.shows[0]}/seats`, "PUT", { holdToken, seats: ["A1"] }, own.cookie)).status, 200);
  const bought = await call("/api/bookings", "POST", { showtimeId: ids.shows[0], holdToken, seats: ["A1"], combos: [], paymentMethod: "momo" }, own.cookie);
  assert.equal(bought.status, 201); const booking = bought.body.booking;
  const searched = await call(`/api/bookings?q=${booking.code}`, "GET", undefined, staff);
  check(searched.body.bookings.length === 1 && searched.body.bookings[0].id === booking.id, "Nhân viên tìm vé theo mã chính xác");
  check((await call(`/api/bookings/${booking.id}`, "PATCH", { action: "checkin" }, staff)).body.booking.status === "checked_in", "Nhân viên soát vé trong khoảng giờ cho phép");
  check((await call(`/api/bookings/${booking.id}`, "PATCH", { action: "checkin" }, staff)).status === 409, "Vé đã soát không được dùng lần hai");
  check((await call(`/api/bookings/${booking.id}`, "PATCH", { action: "cancel" }, own.cookie)).status === 409, "Không hủy vé đã được soát");
  check((await call(`/api/showtimes/${ids.shows[0]}/seats`)).body.occupied.includes("A1"), "Vé đã soát vẫn giữ ghế");
  check((await call("/api/bookings", "GET", undefined, own.cookie)).body.bookings.find(b => b.id === booking.id)?.status === "checked_in", "Người dùng thấy trạng thái soát vé từ DB");
  const summary = (await call("/api/admin/summary", "GET", undefined, admin)).body;
  check(summary.revenue === baseline.revenue + 44000 && summary.tickets === baseline.tickets + 1 && summary.orders === baseline.orders + 1, "Thống kê cộng đúng doanh thu/vé đã soát từ DB");
  console.log(`\n${assertions} focused check-in assertions passed.`);
} finally {
  if (process.argv.includes("--cleanup-local-db")) {
    const quote = id => /^[a-f0-9-]{36}$/.test(id) ? `'${id}'` : "''";
    const sql = `DELETE FROM membership_transactions WHERE user_id=${quote(ids.user)}; DELETE FROM booked_seats WHERE booking_id IN (SELECT id FROM bookings WHERE user_id=${quote(ids.user)}); DELETE FROM bookings WHERE user_id=${quote(ids.user)}; DELETE FROM sessions WHERE user_id=${quote(ids.user)}; DELETE FROM users WHERE id=${quote(ids.user)}; DELETE FROM showtimes WHERE movie_id=${quote(ids.movie)}; DELETE FROM rooms WHERE id=${quote(ids.room)}; DELETE FROM movies WHERE id=${quote(ids.movie)};`;
    const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "d1", "execute", "DB", "--local", "--persist-to", ".wrangler/state", "--config", ".sites-runtime/db-init.json", "--command", sql], { stdio: "inherit", env: process.env });
    if (result.status !== 0) console.error("Focused test cleanup failed.");
  }
}
