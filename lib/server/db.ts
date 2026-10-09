import { env } from "cloudflare:workers";
import { makeSeedShowtimes, seedCombos, seedMovies, seedPromotions, seedRooms } from "../seed";
import { hashPassword } from "./password";
import { HttpError } from "./http";

export function getEnv(): Cloudflare.Env { return env as Cloudflare.Env; }
let seedPromise: Promise<void> | undefined;
export async function getDb(): Promise<D1Database> {
  const db = getEnv().DB;
  if (!db) throw new HttpError(503, "Cơ sở dữ liệu chưa được cấu hình. Hãy chạy khởi tạo D1.");
  seedPromise ??= seedDatabase(db).catch(error => { seedPromise = undefined; throw error; });
  await seedPromise;
  return db;
}
async function seedDatabase(db: D1Database) {
  const marker = await db.prepare("SELECT value FROM metadata WHERE key = 'seed-v1'").first();
  if (marker) return;
  const passwordHash = await hashPassword("Demo@123");
  const statements: D1PreparedStatement[] = [];
  for (const [id, name, email, role] of [
    ["admin-demo", "Quản trị Cineverse", "admin@cineverse.vn", "admin"],
    ["staff-demo", "Minh Anh", "staff@cineverse.vn", "staff"],
    ["user-demo", "Khách Cineverse", "user@cineverse.vn", "user"],
  ]) statements.push(db.prepare("INSERT OR IGNORE INTO users (id,name,email,password_hash,role,created_at) VALUES (?,?,?,?,?,?)").bind(id, name, email, passwordHash, role, new Date().toISOString()));
  for (const m of seedMovies) statements.push(db.prepare("INSERT OR IGNORE INTO movies (id,title,original_title,genres,duration,rating,age_rating,poster,backdrop,description,director,cast,release_date,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(m.id, m.title, m.originalTitle, JSON.stringify(m.genres), m.duration, m.rating, m.ageRating, m.poster, m.backdrop, m.description, m.director, JSON.stringify(m.cast), m.releaseDate, m.status));
  for (const r of seedRooms) statements.push(db.prepare("INSERT OR IGNORE INTO rooms (id,name,rows,cols,type) VALUES (?,?,?,?,?)").bind(r.id, r.name, r.rows, r.cols, r.type));
  const showtimes = makeSeedShowtimes();
  // D1 permits at most 100 bindings per query and 50 queries per free invocation.
  // Fourteen screenings per statement keep the complete seed below both limits.
  for (let index = 0; index < showtimes.length; index += 14) {
    const group = showtimes.slice(index, index + 14);
    statements.push(db.prepare(`INSERT OR IGNORE INTO showtimes (id,movie_id,room_id,start_time,price,format) VALUES ${group.map(() => "(?,?,?,?,?,?)").join(",")}`).bind(...group.flatMap(s => [s.id, s.movieId, s.roomId, s.startTime, s.price, s.format])));
  }
  for (const c of seedCombos) statements.push(db.prepare("INSERT OR IGNORE INTO combos (id,name,description,price,image) VALUES (?,?,?,?,?)").bind(c.id, c.name, c.description, c.price, c.image));
  for (const p of seedPromotions) statements.push(db.prepare("INSERT OR IGNORE INTO promotions (id,code,discount_percent,min_total,active) VALUES (?,?,?,?,?)").bind(p.id, p.code, p.discountPercent, p.minTotal, p.active ? 1 : 0));
  statements.push(db.prepare("INSERT OR IGNORE INTO metadata (key,value) VALUES ('seed-v1',?)").bind(new Date().toISOString()));
  await db.batch(statements);
}
