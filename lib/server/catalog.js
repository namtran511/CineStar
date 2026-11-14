import { getDb } from "./db";
// Never fall back to the legacy movies.rating value: only customers' reviews count.
export const movieReviewColumns = "COALESCE((SELECT AVG(r.rating) FROM reviews r WHERE r.movie_id=m.id),0) AS review_rating, (SELECT COUNT(*) FROM reviews r WHERE r.movie_id=m.id) AS review_count";
export function mapMovie(r) { return { id: String(r.id), title: String(r.title), originalTitle: String(r.original_title), genres: JSON.parse(String(r.genres)), duration: Number(r.duration), rating: Number(r.review_rating || 0), reviewCount: Number(r.review_count || 0), ageRating: String(r.age_rating), poster: String(r.poster), backdrop: String(r.backdrop), description: String(r.description), director: String(r.director), cast: JSON.parse(String(r.cast)), releaseDate: String(r.release_date), status: r.status }; }
export function mapShowtime(r) { return { id: String(r.id), movieId: String(r.movie_id), roomId: String(r.room_id), startTime: String(r.start_time), price: Number(r.price), format: String(r.format) }; }
export function mapPromotion(r) { return { id: String(r.id), code: String(r.code), discountPercent: Number(r.discount_percent), minTotal: Number(r.min_total), active: Boolean(r.active) }; }
export async function getCatalog() {
    const db = await getDb();
    const [movies, showtimes, rooms, combos, promotions] = await db.batch([
        db.prepare(`SELECT m.*, ${movieReviewColumns} FROM movies m ORDER BY CASE m.status WHEN 'now' THEN 0 ELSE 1 END, m.title`),
        db.prepare("SELECT * FROM showtimes WHERE NOT EXISTS (SELECT 1 FROM metadata WHERE key='cancelled-showtime:'||showtimes.id) ORDER BY start_time"), db.prepare("SELECT * FROM rooms ORDER BY name"),
        db.prepare("SELECT * FROM combos ORDER BY price"), db.prepare("SELECT * FROM promotions ORDER BY code"),
    ]);
    return { movies: movies.results.map(mapMovie), showtimes: showtimes.results.map(mapShowtime), rooms: rooms.results, combos: combos.results, promotions: promotions.results.map(mapPromotion) };
}
