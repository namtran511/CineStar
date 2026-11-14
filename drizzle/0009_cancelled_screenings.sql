CREATE TRIGGER booking_block_cancelled_screening BEFORE INSERT ON bookings
WHEN EXISTS (SELECT 1 FROM metadata WHERE key='cancelled-showtime:'||NEW.showtime_id)
BEGIN
  SELECT RAISE(ABORT, 'showtime_cancelled');
END;
