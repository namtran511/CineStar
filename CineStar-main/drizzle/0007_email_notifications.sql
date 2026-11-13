ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE users ADD COLUMN email_marketing INTEGER NOT NULL DEFAULT 0 CHECK(email_marketing IN (0,1));
ALTER TABLE users ADD COLUMN email_birthday INTEGER NOT NULL DEFAULT 0 CHECK(email_birthday IN (0,1));
ALTER TABLE users ADD COLUMN email_unsubscribe_token TEXT;

CREATE TABLE email_challenges (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, purpose TEXT NOT NULL CHECK(purpose IN ('register','verify')),
  user_id TEXT, name TEXT NOT NULL, password_hash TEXT, birth_date TEXT,
  marketing INTEGER NOT NULL DEFAULT 0, birthday INTEGER NOT NULL DEFAULT 0,
  code_hash TEXT NOT NULL, expires_at INTEGER NOT NULL, resend_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  UNIQUE(email,purpose)
);
CREATE TABLE email_rate_limits (id TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE email_incidents (
  id TEXT PRIMARY KEY, showtime_id TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('booking','cancel','incident','promotion','birthday')),
  source_id TEXT NOT NULL, data TEXT NOT NULL, rendered TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
  lease_until INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL,
  sent_at INTEGER, provider_id TEXT, last_error TEXT
);
CREATE INDEX email_outbox_due ON email_outbox(status,next_attempt,lease_until);

-- Events are committed with the booking/promotion, even if email delivery fails.
CREATE TRIGGER email_booking_created AFTER INSERT ON bookings WHEN NEW.status='paid'
BEGIN
  INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
  SELECT 'booking:'||NEW.id,u.id,u.email,'booking',NEW.id,
    json_object('name',u.name,'code',NEW.code,'movie',m.title,'room',r.name,'startTime',s.start_time,
      'seats',json(NEW.seats),'total',NEW.total,'paymentMethod',NEW.payment_method),
    unixepoch()*1000
  FROM users u JOIN showtimes s ON s.id=NEW.showtime_id JOIN movies m ON m.id=s.movie_id JOIN rooms r ON r.id=s.room_id
  WHERE u.id=NEW.user_id AND u.role='user' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL;
END;
CREATE TRIGGER email_booking_cancelled AFTER UPDATE OF status ON bookings WHEN NEW.status='cancelled' AND OLD.status!='cancelled'
BEGIN
  INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
  SELECT 'cancel:'||NEW.id,u.id,u.email,'cancel',NEW.id,
    json_object('name',u.name,'code',NEW.code,'movie',m.title,'room',r.name,'startTime',s.start_time,
      'seats',json(NEW.seats),'total',NEW.total,'pointsSpent',NEW.points_spent),unixepoch()*1000
  FROM users u JOIN showtimes s ON s.id=NEW.showtime_id JOIN movies m ON m.id=s.movie_id JOIN rooms r ON r.id=s.room_id
  WHERE u.id=NEW.user_id AND u.role='user' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL;
END;
CREATE TRIGGER email_promotion_created AFTER INSERT ON promotions WHEN NEW.active=1
BEGIN
  INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
  SELECT 'promotion:'||NEW.id||':'||u.id,u.id,u.email,'promotion',NEW.id,
    json_object('name',u.name,'code',NEW.code,'discountPercent',NEW.discount_percent,'minTotal',NEW.min_total),unixepoch()*1000
  FROM users u WHERE u.role='user' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL AND u.email_marketing=1;
END;
CREATE TRIGGER email_promotion_activated AFTER UPDATE OF active ON promotions WHEN NEW.active=1 AND OLD.active=0
BEGIN
  INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
  SELECT 'promotion:'||NEW.id||':'||u.id,u.id,u.email,'promotion',NEW.id,
    json_object('name',u.name,'code',NEW.code,'discountPercent',NEW.discount_percent,'minTotal',NEW.min_total),unixepoch()*1000
  FROM users u WHERE u.role='user' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL AND u.email_marketing=1;
END;
-- Changing an address must never transfer verification or consent to its new owner.
CREATE TRIGGER email_address_changed AFTER UPDATE OF email ON users WHEN NEW.email<>OLD.email
BEGIN
  UPDATE users SET email_verified_at=NULL,email_marketing=0,email_birthday=0,email_unsubscribe_token=NULL WHERE id=NEW.id;
  DELETE FROM email_challenges WHERE user_id=NEW.id;
END;
