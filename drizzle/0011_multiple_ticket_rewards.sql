DROP INDEX membership_reward_claims_booking_id_unique;
CREATE INDEX membership_reward_claims_booking_id_idx ON membership_reward_claims(booking_id);

DROP TRIGGER payment_release_pending;
CREATE TRIGGER payment_release_pending AFTER UPDATE OF status ON bookings
WHEN OLD.status='pending' AND NEW.status IN ('expired','cancelled')
BEGIN
  INSERT INTO membership_transactions(id,user_id,delta,description,event_key,booking_id,created_at)
    SELECT 'release:'||NEW.id,NEW.user_id,NEW.points_spent,'Hoàn điểm đơn chưa thanh toán '||NEW.code,
      'release:'||NEW.id,NEW.id,strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE NEW.points_spent>0;
  UPDATE users SET points=points+NEW.points_spent WHERE id=NEW.user_id;
  UPDATE membership_rewards SET status='available'
    WHERE id IN (SELECT reward_id FROM membership_reward_claims WHERE booking_id=NEW.id) AND status='used';
  DELETE FROM membership_reward_claims WHERE booking_id=NEW.id;
  DELETE FROM membership_birthday_claims WHERE booking_id=NEW.id;
  DELETE FROM booked_seats WHERE booking_id=NEW.id;
END;
