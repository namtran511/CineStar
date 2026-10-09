import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), role: text("role", { enum: ["admin", "staff", "user"] }).notNull().default("user"), createdAt: text("created_at").notNull(),
});
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), expiresAt: integer("expires_at").notNull(),
});
export const movies = sqliteTable("movies", {
  id: text("id").primaryKey(), title: text("title").notNull(), originalTitle: text("original_title").notNull(), genres: text("genres").notNull(), duration: integer("duration").notNull(), rating: real("rating").notNull(), ageRating: text("age_rating").notNull(), poster: text("poster").notNull(), backdrop: text("backdrop").notNull(), description: text("description").notNull(), director: text("director").notNull(), cast: text("cast").notNull(), releaseDate: text("release_date").notNull(), status: text("status", { enum: ["now", "coming"] }).notNull(),
});
export const rooms = sqliteTable("rooms", { id: text("id").primaryKey(), name: text("name").notNull(), rows: integer("rows").notNull(), cols: integer("cols").notNull(), type: text("type").notNull() });
export const showtimes = sqliteTable("showtimes", {
  id: text("id").primaryKey(), movieId: text("movie_id").notNull().references(() => movies.id), roomId: text("room_id").notNull().references(() => rooms.id), startTime: text("start_time").notNull(), price: integer("price").notNull(), format: text("format").notNull(),
}, (t) => [index("showtimes_start_idx").on(t.startTime)]);
export const combos = sqliteTable("combos", { id: text("id").primaryKey(), name: text("name").notNull(), description: text("description").notNull(), price: integer("price").notNull(), image: text("image").notNull() });
export const promotions = sqliteTable("promotions", { id: text("id").primaryKey(), code: text("code").notNull().unique(), discountPercent: integer("discount_percent").notNull(), minTotal: integer("min_total").notNull(), active: integer("active", { mode: "boolean" }).notNull() });
export const bookings = sqliteTable("bookings", {
  id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), showtimeId: text("showtime_id").notNull().references(() => showtimes.id), seats: text("seats").notNull(), combos: text("combos").notNull(), total: integer("total").notNull(), code: text("code").notNull().unique(), status: text("status", { enum: ["paid", "cancelled", "checked_in"] }).notNull(), createdAt: text("created_at").notNull(), paymentMethod: text("payment_method").notNull(),
}, (t) => [index("bookings_user_idx").on(t.userId)]);
export const bookedSeats = sqliteTable("booked_seats", {
  id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }), showtimeId: text("showtime_id").notNull().references(() => showtimes.id), seat: text("seat").notNull(),
}, (t) => [uniqueIndex("booked_seats_showtime_seat_unique").on(t.showtimeId, t.seat)]);
export const metadata = sqliteTable("metadata", { key: text("key").primaryKey(), value: text("value").notNull() });
