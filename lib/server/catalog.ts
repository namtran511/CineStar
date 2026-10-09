import type { Catalog, Combo, Movie, Promotion, Room, Showtime } from "../types";
import { getDb } from "./db";
type Row = Record<string, unknown>;
export function mapMovie(r: Row): Movie { return { id: String(r.id), title: String(r.title), originalTitle: String(r.original_title), genres: JSON.parse(String(r.genres)), duration: Number(r.duration), rating: Number(r.rating), ageRating: String(r.age_rating), poster: String(r.poster), backdrop: String(r.backdrop), description: String(r.description), director: String(r.director), cast: JSON.parse(String(r.cast)), releaseDate: String(r.release_date), status: r.status as Movie["status"] }; }
export function mapShowtime(r: Row): Showtime { return { id: String(r.id), movieId: String(r.movie_id), roomId: String(r.room_id), startTime: String(r.start_time), price: Number(r.price), format: String(r.format) }; }
export function mapPromotion(r: Row): Promotion { return { id: String(r.id), code: String(r.code), discountPercent: Number(r.discount_percent), minTotal: Number(r.min_total), active: Boolean(r.active) }; }
export async function getCatalog(): Promise<Catalog> {
  const db = await getDb();
  const [movies, showtimes, rooms, combos, promotions] = await db.batch([
    db.prepare("SELECT * FROM movies ORDER BY CASE status WHEN 'now' THEN 0 ELSE 1 END, title"),
    db.prepare("SELECT * FROM showtimes ORDER BY start_time"), db.prepare("SELECT * FROM rooms ORDER BY name"),
    db.prepare("SELECT * FROM combos ORDER BY price"), db.prepare("SELECT * FROM promotions ORDER BY code"),
  ]);
  return { movies: (movies.results as Row[]).map(mapMovie), showtimes: (showtimes.results as Row[]).map(mapShowtime), rooms: rooms.results as unknown as Room[], combos: combos.results as unknown as Combo[], promotions: (promotions.results as Row[]).map(mapPromotion) };
}
