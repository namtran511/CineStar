CREATE TABLE `membership_birthday_claims` (
	`user_id` text NOT NULL,
	`birthday_year` integer NOT NULL,
	`booking_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_birthday_claims_booking_id_unique` ON `membership_birthday_claims` (`booking_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `membership_birthday_claims_user_year_unique` ON `membership_birthday_claims` (`user_id`,`birthday_year`);--> statement-breakpoint
CREATE TABLE `membership_reward_claims` (
	`reward_id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	FOREIGN KEY (`reward_id`) REFERENCES `membership_rewards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_reward_claims_booking_id_unique` ON `membership_reward_claims` (`booking_id`);--> statement-breakpoint
CREATE TABLE `membership_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`reward_key` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`points_cost` integer NOT NULL,
	`code` text NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`created_at` text NOT NULL,
	`fulfilled_at` text,
	`fulfilled_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fulfilled_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "membership_rewards_status_valid" CHECK("membership_rewards"."status" IN ('available','used','fulfilled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_rewards_code_unique` ON `membership_rewards` (`code`);--> statement-breakpoint
CREATE INDEX `membership_rewards_user_idx` ON `membership_rewards` (`user_id`);--> statement-breakpoint
CREATE TABLE `membership_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`delta` integer NOT NULL,
	`description` text NOT NULL,
	`event_key` text NOT NULL,
	`booking_id` text,
	`reward_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reward_id`) REFERENCES `membership_rewards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_transactions_event_key_unique` ON `membership_transactions` (`event_key`);--> statement-breakpoint
CREATE INDEX `membership_transactions_user_idx` ON `membership_transactions` (`user_id`);--> statement-breakpoint
ALTER TABLE `bookings` ADD `points_spent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `points_earned` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `discount_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bookings` ADD `birthday_year` integer;--> statement-breakpoint
ALTER TABLE `bookings` ADD `reward_id` text;--> statement-breakpoint
-- Add columns in place: rebuilding users would risk existing session/review FKs.
ALTER TABLE `users` ADD `birth_date` text;--> statement-breakpoint
ALTER TABLE `users` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `points` integer DEFAULT 0 NOT NULL CONSTRAINT `users_points_nonnegative` CHECK (`points` >= 0);--> statement-breakpoint
ALTER TABLE `users` ADD `lifetime_points` integer DEFAULT 0 NOT NULL CONSTRAINT `users_lifetime_points_nonnegative` CHECK (`lifetime_points` >= 0);
