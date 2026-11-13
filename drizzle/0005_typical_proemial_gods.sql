CREATE TABLE `seat_hold_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`showtime_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`showtime_id`) REFERENCES `showtimes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "seat_hold_sessions_deadline" CHECK("seat_hold_sessions"."expires_at" > "seat_hold_sessions"."created_at" AND "seat_hold_sessions"."expires_at" <= "seat_hold_sessions"."created_at" + 600000)
);
--> statement-breakpoint
CREATE INDEX `seat_hold_sessions_expiry_idx` ON `seat_hold_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `seat_holds` (
	`id` text PRIMARY KEY NOT NULL,
	`hold_token` text NOT NULL,
	`showtime_id` text NOT NULL,
	`seat` text NOT NULL,
	FOREIGN KEY (`hold_token`) REFERENCES `seat_hold_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`showtime_id`) REFERENCES `showtimes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seat_holds_showtime_seat_unique` ON `seat_holds` (`showtime_id`,`seat`);--> statement-breakpoint
CREATE INDEX `seat_holds_token_idx` ON `seat_holds` (`hold_token`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `seat_hold_token` text;
--> statement-breakpoint
-- Claim checks run inside the same transaction as the replacement selection.
-- Expiry uses the database clock so an expired hold cannot win a payment race.
CREATE TRIGGER seat_holds_validate_insert BEFORE INSERT ON seat_holds
BEGIN
    SELECT RAISE(ABORT, 'seat_hold_unavailable')
    WHERE EXISTS (SELECT 1 FROM booked_seats WHERE showtime_id=NEW.showtime_id AND seat=NEW.seat);
    SELECT RAISE(ABORT, 'seat_hold_invalid')
    WHERE NOT EXISTS (
        SELECT 1 FROM seat_hold_sessions h
        JOIN users u ON u.id=h.user_id
        JOIN showtimes s ON s.id=h.showtime_id
        JOIN rooms r ON r.id=s.room_id
        WHERE h.id=NEW.hold_token AND h.showtime_id=NEW.showtime_id
          AND h.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
          AND julianday(s.start_time)>julianday('now','+10 minutes')
          AND u.deleted_at IS NULL
          AND length(NEW.seat) BETWEEN 2 AND 3
          AND unicode(substr(NEW.seat,1,1)) BETWEEN 65 AND 64+r.rows
          AND CAST(substr(NEW.seat,2) AS INTEGER) BETWEEN 1 AND r.cols
          AND NEW.seat=substr(NEW.seat,1,1)||CAST(CAST(substr(NEW.seat,2) AS INTEGER) AS TEXT)
    );
    SELECT RAISE(ABORT, 'seat_hold_limit')
    WHERE (SELECT count(*) FROM seat_holds WHERE hold_token=NEW.hold_token)>=8;
END;
--> statement-breakpoint
CREATE TRIGGER booked_seats_require_hold BEFORE INSERT ON booked_seats
BEGIN
    SELECT RAISE(ABORT, 'seat_hold_expired_or_not_owned')
    WHERE NOT EXISTS (
        SELECT 1 FROM seat_holds h
        JOIN seat_hold_sessions s ON s.id=h.hold_token
        JOIN bookings b ON b.id=NEW.booking_id
        WHERE h.showtime_id=NEW.showtime_id AND h.seat=NEW.seat
          AND s.showtime_id=NEW.showtime_id AND b.showtime_id=NEW.showtime_id
          AND s.id=b.seat_hold_token AND s.user_id=b.user_id AND b.status='paid'
          AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
    );
END;
--> statement-breakpoint
CREATE TRIGGER booked_seats_consume_hold AFTER INSERT ON booked_seats
BEGIN
    DELETE FROM seat_holds WHERE showtime_id=NEW.showtime_id AND seat=NEW.seat;
END;
