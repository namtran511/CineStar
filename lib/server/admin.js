import { z } from "zod";
import { getCatalog, mapMovie, mapPromotion, mapShowtime, movieReviewColumns } from "./catalog";
import { getDb } from "./db";
import { HttpError } from "./http";
import { listBookings } from "./bookings";
const safeImage = z.string().max(1000).refine(value => /^https?:\/\//.test(value) || /^\/(?!\/)/.test(value), "Ảnh cần là đường dẫn / hoặc URL http/https.");
const schemas = {
    movies: z.object({ title: z.string().trim().min(1).max(150), originalTitle: z.string().trim().min(1).max(150), genres: z.array(z.string().trim().min(1).max(50)).min(1).max(8), duration: z.number().int().min(30).max(300), ageRating: z.enum(["P", "K", "T13", "T16", "T18", "C"]), poster: safeImage, backdrop: safeImage, description: z.string().trim().min(10).max(5000), director: z.string().trim().min(1).max(150), cast: z.array(z.string().trim().min(1).max(150)).max(30), releaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), status: z.enum(["now", "coming"]) }),
    rooms: z.object({ name: z.string().trim().min(1).max(100), rows: z.number().int().min(2).max(20), cols: z.number().int().min(4).max(30), type: z.string().trim().min(1).max(50) }),
    showtimes: z.object({ movieId: z.string().min(1).max(100), roomId: z.string().min(1).max(100), startTime: z.string().refine(s => Number.isFinite(Date.parse(s)), "Giờ chiếu không hợp lệ."), price: z.number().int().min(10000).max(1000000), format: z.string().trim().min(1).max(100) }),
    combos: z.object({ name: z.string().trim().min(1).max(100), description: z.string().trim().min(1).max(500), price: z.number().int().min(0).max(1000000), image: safeImage }),
    promotions: z.object({ code: z.string().trim().min(3).max(30).regex(/^[A-Za-z0-9_-]+$/).transform(s => s.toUpperCase()), discountPercent: z.number().int().min(1).max(100), minTotal: z.number().int().min(0).max(10000000), active: z.boolean() }),
};
const fields = {
    movies: { title: "title", originalTitle: "original_title", genres: "genres", duration: "duration", ageRating: "age_rating", poster: "poster", backdrop: "backdrop", description: "description", director: "director", cast: "cast", releaseDate: "release_date", status: "status" },
    rooms: { name: "name", rows: "rows", cols: "cols", type: "type" },
    showtimes: { movieId: "movie_id", roomId: "room_id", startTime: "start_time", price: "price", format: "format" },
    combos: { name: "name", description: "description", price: "price", image: "image" },
    promotions: { code: "code", discountPercent: "discount_percent", minTotal: "min_total", active: "active" },
};
function mapResource(resource, row) {
    if (resource === "movies")
        return mapMovie(row);
    if (resource === "showtimes")
        return mapShowtime(row);
    if (resource === "promotions")
        return mapPromotion(row);
    return row;
}
export function singular(resource) { return { movies: "movie", rooms: "room", showtimes: "showtime", combos: "combo", promotions: "promotion" }[resource]; }
export async function listResource(resource) { return (await getCatalog())[resource]; }
export async function saveResource(resource, body, id) {
    if (resource === "movies" && ["rating", "reviewCount", "review_count", "review_rating"].some(key => Object.hasOwn(body, key)))
        throw new HttpError(400, "Điểm phim được tính từ đánh giá của khách hàng và không thể chỉnh sửa.");
    const db = await getDb();
    let current = null;
    if (id) {
        const row = await db.prepare(`SELECT * FROM ${resource} WHERE id=?`).bind(id).first();
        if (!row)
            throw new HttpError(404, "Dữ liệu không tồn tại.");
        current = mapResource(resource, row);
    }
    const parsed = schemas[resource].safeParse({ ...current, ...body });
    if (!parsed.success)
        throw new HttpError(400, parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join(" · "));
    const data = parsed.data;
    if (resource === "movies" && id && current) {
        const future = await db.prepare("SELECT id FROM showtimes WHERE movie_id=? AND start_time>? LIMIT 1").bind(id, new Date().toISOString()).first();
        if (future && data.status !== "now")
            throw new HttpError(409, "Phim còn suất chiếu sắp tới; cần xử lý lịch trước khi chuyển sang sắp chiếu.");
        if (future && Number(data.duration) !== Number(current.duration)) {
            const shows = await db.prepare("SELECT s.id,s.movie_id,s.room_id,s.start_time,m.duration FROM showtimes s JOIN movies m ON m.id=s.movie_id WHERE s.room_id IN (SELECT room_id FROM showtimes WHERE movie_id=? AND start_time>?) AND s.start_time>?").bind(id, new Date().toISOString(), new Date(Date.now() - 5 * 3600000).toISOString()).all();
            for (const show of shows.results.filter(s => s.movie_id === id && Date.parse(s.start_time) > Date.now())) {
                const start = Date.parse(show.start_time);
                const end = start + (Number(data.duration) + 15) * 60000;
                if (shows.results.some(other => other.id !== show.id && other.room_id === show.room_id && start < Date.parse(other.start_time) + ((other.movie_id === id ? Number(data.duration) : other.duration) + 15) * 60000 && end > Date.parse(other.start_time)))
                    throw new HttpError(409, "Thời lượng mới gây trùng lịch phòng. Hãy điều chỉnh các suất chiếu trước.");
            }
        }
    }
    if (resource === "showtimes") {
        data.startTime = new Date(String(data.startTime)).toISOString();
        if (Date.parse(String(data.startTime)) <= Date.now())
            throw new HttpError(400, "Giờ chiếu cần nằm trong tương lai.");
        const movie = await db.prepare("SELECT duration,status FROM movies WHERE id=?").bind(String(data.movieId)).first();
        const room = await db.prepare("SELECT id FROM rooms WHERE id=?").bind(String(data.roomId)).first();
        if (!movie || !room)
            throw new HttpError(400, "Phim hoặc phòng chiếu không tồn tại.");
        if (movie.status !== "now")
            throw new HttpError(400, "Chỉ được tạo suất cho phim đang chiếu.");
        if (id && await db.prepare("SELECT id FROM bookings WHERE showtime_id=? LIMIT 1").bind(id).first())
            throw new HttpError(409, "Suất đã có vé; không thể thay đổi lịch và giá.");
        if (id && await db.prepare("SELECT id FROM seat_hold_sessions WHERE showtime_id=? AND expires_at>? LIMIT 1").bind(id, Date.now()).first())
            throw new HttpError(409, "Suất đang có khách giữ ghế. Vui lòng chờ khách thanh toán hoặc hết hạn giữ ghế.");
        const otherShows = await db.prepare("SELECT s.start_time,m.duration FROM showtimes s JOIN movies m ON m.id=s.movie_id WHERE s.room_id=? AND s.id<>?").bind(String(data.roomId), id || "").all();
        const start = Date.parse(String(data.startTime));
        const end = start + (movie.duration + 15) * 60000;
        if (otherShows.results.some(s => start < Date.parse(s.start_time) + (s.duration + 15) * 60000 && end > Date.parse(s.start_time)))
            throw new HttpError(409, "Phòng đang có suất chiếu trùng giờ. Cần 15 phút dọn phòng sau phim.");
    }
    if (resource === "rooms" && id && current && (Number(data.rows) < Number(current.rows) || Number(data.cols) < Number(current.cols))) {
        const seats = await db.prepare("SELECT bs.seat FROM booked_seats bs JOIN showtimes s ON s.id=bs.showtime_id WHERE s.room_id=?").bind(id).all();
        if (seats.results.some(({ seat }) => seat.charCodeAt(0) - 65 >= Number(data.rows) || Number(seat.slice(1)) > Number(data.cols)))
            throw new HttpError(409, "Kích thước mới loại bỏ ghế đã đặt.");
        const holds = await db.prepare("SELECT h.seat FROM seat_holds h JOIN seat_hold_sessions hs ON hs.id=h.hold_token JOIN showtimes s ON s.id=h.showtime_id WHERE s.room_id=? AND hs.expires_at>?").bind(id, Date.now()).all();
        if (holds.results.some(({ seat }) => seat.charCodeAt(0) - 65 >= Number(data.rows) || Number(seat.slice(1)) > Number(data.cols)))
            throw new HttpError(409, "Kích thước mới loại bỏ ghế khách đang giữ.");
    }
    const keys = Object.keys(fields[resource]);
    const values = keys.map(key => Array.isArray(data[key]) ? JSON.stringify(data[key]) : typeof data[key] === "boolean" ? Number(data[key]) : data[key]);
    const recordId = id || crypto.randomUUID();
    try {
        if (id)
            await db.prepare(`UPDATE ${resource} SET ${keys.map(k => `${fields[resource][k]}=?`).join(",")} WHERE id=?`).bind(...values, id).run();
        else {
            const columns = keys.map(k => fields[resource][k]);
            // Keep the old required column compatible without exposing it as editable data.
            if (resource === "movies") {
                columns.push("rating");
                values.push(0);
            }
            await db.prepare(`INSERT INTO ${resource} (id,${columns.join(",")}) VALUES (${[recordId, ...values].map(() => "?").join(",")})`).bind(recordId, ...values).run();
        }
    }
    catch (error) {
        if (String(error).includes("seat_hold_admin_conflict"))
            throw new HttpError(409, "Có khách vừa giữ ghế. Chưa thể thay đổi suất chiếu hoặc loại bỏ ghế đang được giữ.");
        if (String(error).includes("UNIQUE"))
            throw new HttpError(409, "Dữ liệu bị trùng (mã ưu đãi đã tồn tại).");
        throw error;
    }
    const resultQuery = resource === "movies"
        ? `SELECT m.*, ${movieReviewColumns} FROM movies m WHERE m.id=?`
        : `SELECT * FROM ${resource} WHERE id=?`;
    return mapResource(resource, await db.prepare(resultQuery).bind(recordId).first());
}
export async function deleteResource(resource, id) {
    const db = await getDb();
    if (!await db.prepare(`SELECT id FROM ${resource} WHERE id=?`).bind(id).first())
        throw new HttpError(404, "Dữ liệu không tồn tại.");
    if (resource === "showtimes" && await db.prepare("SELECT id FROM seat_hold_sessions WHERE showtime_id=? AND expires_at>? LIMIT 1").bind(id, Date.now()).first())
        throw new HttpError(409, "Suất đang có khách giữ ghế; chưa thể xóa.");
    try {
        await db.prepare(`DELETE FROM ${resource} WHERE id=?`).bind(id).run();
    }
    catch (error) {
        if (String(error).includes("seat_hold_admin_conflict"))
            throw new HttpError(409, "Có khách vừa giữ ghế; chưa thể xóa suất chiếu.");
        if (String(error).toLowerCase().includes("foreign key"))
            throw new HttpError(409, "Dữ liệu đang được sử dụng bởi suất chiếu hoặc vé; hãy xử lý dữ liệu liên quan trước.");
        throw error;
    }
}
function localDay(date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date); }
export async function getSummary(admin) {
    const db = await getDb();
    const catalog = await getCatalog();
    const rows = await db.prepare("SELECT b.total,b.seats,b.created_at,b.showtime_id,m.title FROM bookings b JOIN showtimes s ON s.id=b.showtime_id JOIN movies m ON m.id=s.movie_id WHERE b.status IN ('paid','checked_in')").all();
    const daily = Array.from({ length: 7 }, (_, i) => ({ date: localDay(new Date(Date.now() - (6 - i) * 86400000)), revenue: 0 }));
    const byMovie = new Map();
    let revenue = 0;
    let tickets = 0;
    let occupied = 0;
    const futureShows = catalog.showtimes.filter(s => Date.parse(s.startTime) > Date.now() && Date.parse(s.startTime) < Date.now() + 7 * 86400000);
    const futureIds = new Set(futureShows.map(s => s.id));
    for (const b of rows.results) {
        const count = JSON.parse(b.seats).length;
        revenue += b.total;
        tickets += count;
        if (futureIds.has(b.showtime_id))
            occupied += count;
        const day = daily.find(d => d.date === localDay(new Date(b.created_at)));
        if (day)
            day.revenue += b.total;
        const record = byMovie.get(b.title) || { title: b.title, revenue: 0, tickets: 0 };
        record.revenue += b.total;
        record.tickets += count;
        byMovie.set(b.title, record);
    }
    const capacity = futureShows.reduce((sum, s) => { const r = catalog.rooms.find(r => r.id === s.roomId); return sum + (r ? r.rows * r.cols : 0); }, 0);
    return { revenue, tickets, orders: rows.results.length, occupancy: capacity ? Math.round(occupied / capacity * 1000) / 10 : 0, dailyRevenue: daily, byMovie: [...byMovie.values()].sort((a, b) => b.revenue - a.revenue), recentBookings: (await listBookings(admin)).slice(0, 8) };
}
