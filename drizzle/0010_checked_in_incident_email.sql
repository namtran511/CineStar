CREATE TRIGGER email_checked_in_cancelled AFTER UPDATE OF status ON bookings
WHEN NEW.status='cancelled' AND OLD.status='checked_in'
BEGIN
  INSERT OR IGNORE INTO email_outbox(id,user_id,recipient,kind,source_id,data,created_at)
  SELECT 'cancel:'||NEW.id,u.id,u.email,'cancel',NEW.id,
    json_object('name',u.name,'code',NEW.code,'movie',m.title,'room',r.name,'startTime',s.start_time,
      'seats',json(NEW.seats),'total',NEW.total,'pointsSpent',NEW.points_spent,'paymentProvider',NEW.payment_provider),unixepoch()*1000
  FROM users u JOIN showtimes s ON s.id=NEW.showtime_id JOIN movies m ON m.id=s.movie_id JOIN rooms r ON r.id=s.room_id
  WHERE u.id=NEW.user_id AND u.role='user' AND u.deleted_at IS NULL AND u.email_verified_at IS NOT NULL;
END;
