import { z } from "zod";
import { mapMovie, movieReviewColumns } from "./catalog";
import { getDb } from "./db";
import { HttpError } from "./http";

const PAGE_SIZE = 10;
const reviewSchema = z.object({
    rating: z.number().int().min(1).max(10),
    comment: z.string().trim().min(1).max(2000),
}).strict();

// SQLite understands stored ISO timestamps and evaluates the whole eligibility
// predicate in the same statement as insertion, including the current user role.
const screeningEnd = "julianday(s.start_time) + m.duration / 1440.0";
const eligibleBooking = `FROM bookings b
    JOIN showtimes s ON s.id=b.showtime_id
    JOIN movies m ON m.id=s.movie_id
    JOIN users u ON u.id=b.user_id
    WHERE b.user_id=? AND m.id=? AND u.role='user' AND u.deleted_at IS NULL
      AND b.status='checked_in' AND ${screeningEnd}<=julianday(?)`;

function requireCustomer(user) {
    if (!user)
        throw new HttpError(401, "Vui lòng đăng nhập để đánh giá phim.");
    if (user.role !== "user")
        throw new HttpError(403, "Chỉ khách hàng đã xem phim mới được gửi đánh giá.");
}

function mapReview(row) {
    return {
        id: String(row.id),
        movieId: String(row.movie_id),
        rating: Number(row.rating),
        comment: String(row.comment),
        authorName: String(row.author_name),
        createdAt: String(row.created_at),
    };
}

function mapSummary(row) {
    return { rating: Number(row.rating || 0), reviewCount: Number(row.review_count || 0) };
}

function summaryQuery(db, movieId) {
    return db.prepare("SELECT COALESCE(AVG(rating),0) AS rating, COUNT(*) AS review_count FROM reviews WHERE movie_id=?").bind(movieId);
}

export async function getMovieReviews(movieId, user, offsetValue = "0") {
    if (!/^\d+$/.test(offsetValue) || !Number.isSafeInteger(Number(offsetValue)))
        throw new HttpError(400, "Vị trí trang đánh giá không hợp lệ.");
    const offset = Number(offsetValue);
    const db = await getDb();
    const now = new Date().toISOString();
    const [movie, page, summary, own, eligible] = await db.batch([
        db.prepare("SELECT id FROM movies WHERE id=?").bind(movieId),
        db.prepare("SELECT id,movie_id,rating,comment,author_name,created_at FROM reviews WHERE movie_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?").bind(movieId, PAGE_SIZE, offset),
        summaryQuery(db, movieId),
        user
            ? db.prepare("SELECT id,movie_id,rating,comment,author_name,created_at FROM reviews WHERE user_id=? AND movie_id=?").bind(user.id, movieId)
            : db.prepare("SELECT 1 WHERE 0"),
        user?.role === "user"
            ? db.prepare(`SELECT b.id ${eligibleBooking} LIMIT 1`).bind(user.id, movieId, now)
            : db.prepare("SELECT 1 WHERE 0"),
    ]);
    if (!movie.results.length)
        throw new HttpError(404, "Phim không tồn tại.");
    const aggregate = mapSummary(summary.results[0]);
    const reviews = page.results.map(mapReview);
    const ownReview = own.results[0] ? mapReview(own.results[0]) : null;
    return {
        reviews,
        total: aggregate.reviewCount,
        ...aggregate,
        canReview: !ownReview && eligible.results.length > 0,
        ownReview,
        nextOffset: offset + reviews.length < aggregate.reviewCount ? offset + reviews.length : null,
    };
}

export async function createMovieReview(movieId, user, body) {
    requireCustomer(user);
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success)
        throw new HttpError(400, "Chọn điểm nguyên từ 1 đến 10 và viết nhận xét từ 1 đến 2.000 ký tự.");
    const db = await getDb();
    if (!await db.prepare("SELECT id FROM movies WHERE id=?").bind(movieId).first())
        throw new HttpError(404, "Phim không tồn tại.");
    const now = new Date().toISOString();
    let review;
    try {
        review = await db.prepare(`INSERT INTO reviews
            (id,user_id,movie_id,booking_id,author_name,rating,comment,created_at)
            SELECT ?,u.id,m.id,b.id,u.name,?,?,?
            ${eligibleBooking}
            ORDER BY ${screeningEnd} DESC,b.id DESC LIMIT 1
            RETURNING id,movie_id,rating,comment,author_name,created_at`)
            .bind(crypto.randomUUID(), parsed.data.rating, parsed.data.comment, now, user.id, movieId, now).first();
    }
    catch (error) {
        if (String(error).includes("UNIQUE"))
            throw new HttpError(409, "Bạn đã đánh giá phim này. Mỗi khách hàng được đánh giá một lần cho mỗi phim.");
        throw error;
    }
    if (!review) {
        const duplicate = await db.prepare("SELECT id FROM reviews WHERE user_id=? AND movie_id=?").bind(user.id, movieId).first();
        if (duplicate)
            throw new HttpError(409, "Bạn đã đánh giá phim này. Mỗi khách hàng được đánh giá một lần cho mỗi phim.");
        throw new HttpError(403, "Bạn chỉ có thể đánh giá sau khi vé đã được soát và suất chiếu kết thúc.");
    }
    return { review: mapReview(review), ...mapSummary(await summaryQuery(db, movieId).first()) };
}

export async function getMyReviews(user) {
    requireCustomer(user);
    const db = await getDb();
    const now = new Date().toISOString();
    const [reviewed, unreviewed] = await db.batch([
        db.prepare(`SELECT m.*, ${movieReviewColumns},
            r.id AS review_id,r.rating AS customer_rating,r.comment,r.author_name,r.created_at AS review_created_at,
            strftime('%Y-%m-%dT%H:%M:%fZ', ${screeningEnd}) AS watched_at
            FROM reviews r JOIN movies m ON m.id=r.movie_id
            JOIN bookings b ON b.id=r.booking_id JOIN showtimes s ON s.id=b.showtime_id
            WHERE r.user_id=? ORDER BY r.created_at DESC,r.id DESC`).bind(user.id),
        db.prepare(`SELECT m.*, ${movieReviewColumns},
            strftime('%Y-%m-%dT%H:%M:%fZ', MAX(${screeningEnd})) AS watched_at
            FROM bookings b JOIN showtimes s ON s.id=b.showtime_id JOIN movies m ON m.id=s.movie_id
            WHERE b.user_id=? AND b.status='checked_in' AND ${screeningEnd}<=julianday(?)
              AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.user_id=b.user_id AND r.movie_id=m.id)
            GROUP BY m.id ORDER BY watched_at DESC,m.id DESC`).bind(user.id, now),
    ]);
    return {
        reviewed: reviewed.results.map(row => ({
            movie: mapMovie(row),
            review: mapReview({ id: row.review_id, movie_id: row.id, rating: row.customer_rating, comment: row.comment, author_name: row.author_name, created_at: row.review_created_at }),
            watchedAt: row.watched_at,
        })),
        unreviewed: unreviewed.results.map(row => ({ movie: mapMovie(row), watchedAt: row.watched_at })),
    };
}
