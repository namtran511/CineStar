CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`movie_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`author_name` text NOT NULL,
	`rating` integer NOT NULL,
	`comment` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`movie_id`) REFERENCES `movies`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "reviews_rating_valid" CHECK(typeof("reviews"."rating") = 'integer' AND "reviews"."rating" BETWEEN 1 AND 10),
	CONSTRAINT "reviews_comment_valid" CHECK(length(trim("reviews"."comment")) BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_movie_unique` ON `reviews` (`user_id`,`movie_id`);--> statement-breakpoint
CREATE INDEX `reviews_movie_created_idx` ON `reviews` (`movie_id`,`created_at`,`id`);