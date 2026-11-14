ALTER TABLE bookings ADD COLUMN payment_provider TEXT NOT NULL DEFAULT 'demo';
ALTER TABLE bookings ADD COLUMN payment_destination TEXT;
ALTER TABLE bookings ADD COLUMN expires_at INTEGER;
ALTER TABLE bookings ADD COLUMN paid_at TEXT;
ALTER TABLE bookings ADD COLUMN payment_transaction_id TEXT;
ALTER TABLE bookings ADD COLUMN refund_status TEXT NOT NULL DEFAULT 'none' CHECK(refund_status IN ('none','pending','refunded'));
CREATE INDEX bookings_pending_expiry ON bookings(status,expires_at);
CREATE UNIQUE INDEX bookings_sepay_transaction ON bookings(payment_transaction_id) WHERE payment_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX bookings_hold_once ON bookings(seat_hold_token) WHERE payment_provider='sepay' AND seat_hold_token IS NOT NULL;

CREATE TABLE payment_events (
  transaction_id TEXT PRIMARY KEY NOT NULL,
  booking_id TEXT REFERENCES bookings(id), code TEXT NOT NULL,
  amount INTEGER NOT NULL, account_number TEXT NOT NULL, gateway TEXT NOT NULL, transfer_type TEXT NOT NULL,
  outcome TEXT NOT NULL, raw_payload TEXT NOT NULL, received_at TEXT NOT NULL
);
CREATE INDEX payment_events_received ON payment_events(received_at,transaction_id);

-- A pending order takes over the selected seats without extending the original
-- ten-minute deadline. Its locks live until payment, expiry or cancellation.
DROP TRIGGER booked_seats_require_hold;
CREATE TRIGGER booked_seats_require_hold BEFORE INSERT ON booked_seats
BEGIN
  SELECT RAISE(ABORT, 'seat_hold_expired_or_not_owned') WHERE NOT EXISTS (
    SELECT 1 FROM seat_holds h JOIN seat_hold_sessions s ON s.id=h.hold_token JOIN bookings b ON b.id=NEW.booking_id
    WHERE h.showtime_id=NEW.showtime_id AND h.seat=NEW.seat
      AND s.showtime_id=NEW.showtime_id AND b.showtime_id=NEW.showtime_id
      AND s.id=b.seat_hold_token AND s.user_id=b.user_id AND b.status IN ('paid','pending')
      AND s.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
      AND (b.status='paid' OR (b.expires_at=s.expires_at AND b.payment_provider='sepay'))
  );
END;

-- Release all reserved benefits in the same transaction as the state change.
-- The OLD.status guard makes expiry, cancellation and concurrent jobs idempotent.
CREATE TRIGGER payment_release_pending AFTER UPDATE OF status ON bookings
WHEN OLD.status='pending' AND NEW.status IN ('expired','cancelled')
BEGIN
  INSERT INTO membership_transactions(id,user_id,delta,description,event_key,booking_id,created_at)
    SELECT 'release:'||NEW.id,NEW.user_id,NEW.points_spent,'Hoàn điểm đơn chưa thanh toán '||NEW.code,
      'release:'||NEW.id,NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE NEW.points_spent>0;
  UPDATE users SET points=points+NEW.points_spent WHERE id=NEW.user_id;
  UPDATE membership_rewards SET status='available' WHERE id=NEW.reward_id AND status='used';
  DELETE FROM membership_reward_claims WHERE booking_id=NEW.id;
  DELETE FROM membership_birthday_claims WHERE booking_id=NEW.id;
  DELETE FROM booked_seats WHERE booking_id=NEW.id;
END;

-- Payment is now a transition rather than an immediate INSERT. Queue the ticket
-- email only after settlement; the unique outbox ID prevents duplicate messages.
CREATE TRIGGER email_booking_paid AFTER UPDATE OF status ON bookings
WHEN OLD.status='pending' AND NEW.status='paid'
BEGIN
  INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
  SELECT 'booking:'||NEW.id,u.id,u.email,'booking',NEW.id,
    json_object('name',u.name,'code',NEW.code,'movie',m.title,'room',r.name,'startTime',s.start_time,
      'seats',json(NEW.seats),'total',NEW.total,'paymentMethod',NEW.payment_method,'paymentProvider',NEW.payment_provider),unixepoch()*1000
  FROM users u JOIN showtimes s ON s.id=NEW.showtime_id JOIN movies m ON m.id=s.movie_id JOIN rooms r ON r.id=s.room_id
  WHERE u.id=NEW.user_id AND u.role='user' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL;
END;

-- Only a previously paid order needs a cancellation/refund email.
DROP TRIGGER email_booking_cancelled;
CREATE TRIGGER email_booking_cancelled AFTER UPDATE OF status ON bookings
WHEN NEW.status='cancelled' AND OLD.status='paid'
BEGIN
  INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
  SELECT 'cancel:'||NEW.id,u.id,u.email,'cancel',NEW.id,
    json_object('name',u.name,'code',NEW.code,'movie',m.title,'room',r.name,'startTime',s.start_time,
      'seats',json(NEW.seats),'total',NEW.total,'pointsSpent',NEW.points_spent,'paymentProvider',NEW.payment_provider),unixepoch()*1000
  FROM users u JOIN showtimes s ON s.id=NEW.showtime_id JOIN movies m ON m.id=s.movie_id JOIN rooms r ON r.id=s.room_id
  WHERE u.id=NEW.user_id AND u.role='user' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL;
END;

DROP TRIGGER email_booking_created;
CREATE TRIGGER email_booking_created AFTER INSERT ON bookings WHEN NEW.status='paid'
BEGIN
  INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
  SELECT 'booking:'||NEW.id,u.id,u.email,'booking',NEW.id,
    json_object('name',u.name,'code',NEW.code,'movie',m.title,'room',r.name,'startTime',s.start_time,
      'seats',json(NEW.seats),'total',NEW.total,'paymentMethod',NEW.payment_method,'paymentProvider',NEW.payment_provider),unixepoch()*1000
  FROM users u JOIN showtimes s ON s.id=NEW.showtime_id JOIN movies m ON m.id=s.movie_id JOIN rooms r ON r.id=s.room_id
  WHERE u.id=NEW.user_id AND u.role='user' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL;
END;

CREATE TRIGGER audit_booking_payment_update AFTER UPDATE ON bookings
WHEN OLD.payment_provider IS NOT NEW.payment_provider OR OLD.expires_at IS NOT NEW.expires_at
  OR OLD.paid_at IS NOT NEW.paid_at OR OLD.payment_transaction_id IS NOT NEW.payment_transaction_id
  OR OLD.refund_status IS NOT NEW.refund_status OR OLD.payment_destination IS NOT NEW.payment_destination
BEGIN
  INSERT INTO audit_logs(request_id,actor_id,actor_name,actor_role,action,entity,entity_id,before_json,after_json,reason,operation,created_at)
  VALUES ((SELECT request_id FROM audit_context WHERE id=1),(SELECT actor_id FROM audit_context WHERE id=1),
    COALESCE((SELECT actor_name FROM audit_context WHERE id=1),'Hệ thống'),COALESCE((SELECT actor_role FROM audit_context WHERE id=1),'system'),
    'update','bookings',NEW.id,
    json_object('paymentProvider',OLD.payment_provider,'expiresAt',OLD.expires_at,'paidAt',OLD.paid_at,'transactionId',OLD.payment_transaction_id,'refundStatus',OLD.refund_status),
    json_object('paymentProvider',NEW.payment_provider,'expiresAt',NEW.expires_at,'paidAt',NEW.paid_at,'transactionId',NEW.payment_transaction_id,'refundStatus',NEW.refund_status),
    COALESCE((SELECT reason FROM audit_context WHERE id=1),'Cập nhật thanh toán'),
    COALESCE((SELECT operation FROM audit_context WHERE id=1),'Payment update'),strftime('%Y-%m-%dT%H:%M:%fZ','now'));
END;
