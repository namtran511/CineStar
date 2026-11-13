-- Serialize administrative edits with seat claims, even if the API precheck
-- ran before another request acquired its hold.
CREATE TRIGGER showtimes_preserve_active_holds BEFORE UPDATE ON showtimes
WHEN (NEW.room_id<>OLD.room_id OR NEW.movie_id<>OLD.movie_id OR NEW.start_time<>OLD.start_time OR NEW.price<>OLD.price OR NEW.format<>OLD.format)
AND EXISTS (SELECT 1 FROM seat_hold_sessions WHERE showtime_id=OLD.id AND expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))
BEGIN
    SELECT RAISE(ABORT, 'seat_hold_admin_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER showtimes_preserve_held_screening BEFORE DELETE ON showtimes
WHEN EXISTS (SELECT 1 FROM seat_hold_sessions WHERE showtime_id=OLD.id AND expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER))
BEGIN
    SELECT RAISE(ABORT, 'seat_hold_admin_conflict');
END;
--> statement-breakpoint
CREATE TRIGGER rooms_preserve_held_seats BEFORE UPDATE OF rows,cols ON rooms
WHEN EXISTS (
    SELECT 1 FROM seat_holds h
    JOIN seat_hold_sessions hs ON hs.id=h.hold_token
    JOIN showtimes s ON s.id=h.showtime_id
    WHERE s.room_id=OLD.id AND hs.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
      AND (unicode(substr(h.seat,1,1))-65>=NEW.rows OR CAST(substr(h.seat,2) AS INTEGER)>NEW.cols)
)
BEGIN
    SELECT RAISE(ABORT, 'seat_hold_admin_conflict');
END;
