import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real, uniqueIndex, index, check } from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
    id: text("id").primaryKey(), name: text("name").notNull(), email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(), role: text("role", { enum: ["admin", "staff", "user"] }).notNull().default("user"), createdAt: text("created_at").notNull(),
    birthDate: text("birth_date"), deletedAt: text("deleted_at"), points: integer("points").notNull().default(0), lifetimePoints: integer("lifetime_points").notNull().default(0),
    emailVerifiedAt:text('email_verified_at'), emailMarketing:integer('email_marketing').notNull().default(0), emailBirthday:integer('email_birthday').notNull().default(0), emailUnsubscribeToken:text('email_unsubscribe_token'),
}, (t) => [check("users_points_nonnegative", sql`${t.points} >= 0`), check("users_lifetime_points_nonnegative", sql`${t.lifetimePoints} >= 0`)]);
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
    id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), showtimeId: text("showtime_id").notNull().references(() => showtimes.id), seats: text("seats").notNull(), combos: text("combos").notNull(), total: integer("total").notNull(), code: text("code").notNull().unique(), status: text("status", { enum: ["pending", "paid", "cancelled", "checked_in", "expired"] }).notNull(), createdAt: text("created_at").notNull(), paymentMethod: text("payment_method").notNull(),
    pointsSpent: integer("points_spent").notNull().default(0), pointsEarned: integer("points_earned").notNull().default(0), discountAmount: integer("discount_amount").notNull().default(0), birthdayYear: integer("birthday_year"), rewardId: text("reward_id"), seatHoldToken: text("seat_hold_token"),
    paymentProvider: text("payment_provider").notNull().default("demo"), paymentDestination: text("payment_destination"), expiresAt: integer("expires_at"), paidAt: text("paid_at"), paymentTransactionId: text("payment_transaction_id"), refundStatus: text("refund_status").notNull().default("none"),
}, (t) => [index("bookings_user_idx").on(t.userId), index("bookings_pending_expiry").on(t.status,t.expiresAt), uniqueIndex("bookings_sepay_transaction").on(t.paymentTransactionId).where(sql`${t.paymentTransactionId} IS NOT NULL`), uniqueIndex("bookings_hold_once").on(t.seatHoldToken).where(sql`${t.paymentProvider} = 'sepay' AND ${t.seatHoldToken} IS NOT NULL`), check("bookings_refund_status",sql`${t.refundStatus} IN ('none','pending','refunded')`)]);
export const paymentEvents = sqliteTable("payment_events", {
    transactionId: text("transaction_id").primaryKey().notNull(), bookingId: text("booking_id").references(() => bookings.id), code: text("code").notNull(), amount: integer("amount").notNull(), accountNumber: text("account_number").notNull(), gateway: text("gateway").notNull(), transferType: text("transfer_type").notNull(), outcome: text("outcome").notNull(), rawPayload: text("raw_payload").notNull(), receivedAt: text("received_at").notNull(),
}, t => [index("payment_events_received").on(t.receivedAt,t.transactionId)]);
export const bookedSeats = sqliteTable("booked_seats", {
    id: text("id").primaryKey(), bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "cascade" }), showtimeId: text("showtime_id").notNull().references(() => showtimes.id), seat: text("seat").notNull(),
}, (t) => [uniqueIndex("booked_seats_showtime_seat_unique").on(t.showtimeId, t.seat)]);
export const seatHoldSessions = sqliteTable("seat_hold_sessions", {
    id: text("id").primaryKey().notNull(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    showtimeId: text("showtime_id").notNull().references(() => showtimes.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(), expiresAt: integer("expires_at").notNull(),
}, (t) => [index("seat_hold_sessions_expiry_idx").on(t.expiresAt), check("seat_hold_sessions_deadline", sql`${t.expiresAt} > ${t.createdAt} AND ${t.expiresAt} <= ${t.createdAt} + 600000`)]);
export const seatHolds = sqliteTable("seat_holds", {
    id: text("id").primaryKey().notNull(),
    holdToken: text("hold_token").notNull().references(() => seatHoldSessions.id, { onDelete: "cascade" }),
    showtimeId: text("showtime_id").notNull().references(() => showtimes.id, { onDelete: "cascade" }),
    seat: text("seat").notNull(),
}, (t) => [uniqueIndex("seat_holds_showtime_seat_unique").on(t.showtimeId, t.seat), index("seat_holds_token_idx").on(t.holdToken)]);
export const reviews = sqliteTable("reviews", {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    movieId: text("movie_id").notNull().references(() => movies.id, { onDelete: "restrict" }),
    bookingId: text("booking_id").notNull().references(() => bookings.id, { onDelete: "restrict" }),
    authorName: text("author_name").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    createdAt: text("created_at").notNull(),
}, (t) => [
    uniqueIndex("reviews_user_movie_unique").on(t.userId, t.movieId),
    index("reviews_movie_created_idx").on(t.movieId, t.createdAt, t.id),
    check("reviews_rating_valid", sql`typeof(${t.rating}) = 'integer' AND ${t.rating} BETWEEN 1 AND 10`),
    check("reviews_comment_valid", sql`length(trim(${t.comment})) BETWEEN 1 AND 2000`),
]);
export const metadata = sqliteTable("metadata", { key: text("key").primaryKey(), value: text("value").notNull() });
export const emailChallenges = sqliteTable('email_challenges', {
    id:text('id').primaryKey(),email:text('email').notNull(),purpose:text('purpose').notNull(),userId:text('user_id'),name:text('name').notNull(),passwordHash:text('password_hash'),birthDate:text('birth_date'),marketing:integer('marketing').notNull().default(0),birthday:integer('birthday').notNull().default(0),codeHash:text('code_hash').notNull(),expiresAt:integer('expires_at').notNull(),resendAt:integer('resend_at').notNull(),attempts:integer('attempts').notNull().default(0),createdAt:integer('created_at').notNull(),
},t=>[uniqueIndex('email_challenges_email_purpose_unique').on(t.email,t.purpose)]);
export const emailRateLimits = sqliteTable('email_rate_limits',{id:text('id').primaryKey(),count:integer('count').notNull(),expiresAt:integer('expires_at').notNull()});
export const emailIncidents = sqliteTable('email_incidents',{id:text('id').primaryKey(),showtimeId:text('showtime_id').notNull(),subject:text('subject').notNull(),message:text('message').notNull(),createdBy:text('created_by').notNull(),createdAt:integer('created_at').notNull()});
export const emailOutbox = sqliteTable('email_outbox',{
    id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),recipient:text('recipient').notNull(),kind:text('kind').notNull(),sourceId:text('source_id').notNull(),data:text('data').notNull(),rendered:text('rendered'),status:text('status').notNull().default('pending'),attempts:integer('attempts').notNull().default(0),nextAttempt:integer('next_attempt').notNull().default(0),leaseUntil:integer('lease_until').notNull().default(0),createdAt:integer('created_at').notNull(),sentAt:integer('sent_at'),providerId:text('provider_id'),lastError:text('last_error'),
},t=>[index('email_outbox_due').on(t.status,t.nextAttempt,t.leaseUntil)]);
export const auditContext = sqliteTable('audit_context', {
    id: integer('id').primaryKey(), requestId:text('request_id'), actorId:text('actor_id'), actorName:text('actor_name'), actorRole:text('actor_role'), reason:text('reason'), operation:text('operation'),
});
export const auditLogs = sqliteTable('audit_logs', {
    id:integer('id').primaryKey({autoIncrement:true}),requestId:text('request_id'),actorId:text('actor_id'),actorName:text('actor_name').notNull(),actorRole:text('actor_role').notNull(),action:text('action').notNull(),entity:text('entity').notNull(),entityId:text('entity_id').notNull(),beforeJson:text('before_json'),afterJson:text('after_json'),reason:text('reason').notNull(),operation:text('operation').notNull(),createdAt:text('created_at').notNull(),
},t=>[index('audit_logs_entity_idx').on(t.entity,t.entityId,t.id),index('audit_logs_actor_idx').on(t.actorId,t.id)]);
export const membershipRewards = sqliteTable("membership_rewards", {
    id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), rewardKey: text("reward_key").notNull(), name: text("name").notNull(), type: text("type").notNull(), pointsCost: integer("points_cost").notNull(), code: text("code").notNull().unique(), status: text("status").notNull().default("available"), createdAt: text("created_at").notNull(), fulfilledAt: text("fulfilled_at"), fulfilledBy: text("fulfilled_by").references(() => users.id),
}, (t) => [index("membership_rewards_user_idx").on(t.userId), check("membership_rewards_status_valid", sql`${t.status} IN ('available','used','fulfilled')`)]);
export const membershipTransactions = sqliteTable("membership_transactions", {
    id: text("id").primaryKey(), userId: text("user_id").notNull().references(() => users.id), delta: integer("delta").notNull(), description: text("description").notNull(), eventKey: text("event_key").notNull().unique(), bookingId: text("booking_id").references(() => bookings.id), rewardId: text("reward_id").references(() => membershipRewards.id), createdAt: text("created_at").notNull(),
}, (t) => [index("membership_transactions_user_idx").on(t.userId)]);
export const membershipBirthdayClaims = sqliteTable("membership_birthday_claims", {
    userId: text("user_id").notNull().references(() => users.id), birthdayYear: integer("birthday_year").notNull(), bookingId: text("booking_id").notNull().unique().references(() => bookings.id),
}, (t) => [uniqueIndex("membership_birthday_claims_user_year_unique").on(t.userId, t.birthdayYear)]);
export const membershipRewardClaims = sqliteTable("membership_reward_claims", {
    rewardId: text("reward_id").primaryKey().references(() => membershipRewards.id), bookingId: text("booking_id").notNull().unique().references(() => bookings.id),
});
