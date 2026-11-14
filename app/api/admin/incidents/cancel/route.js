import { requireUser } from '@/lib/server/auth';
import { getDb } from '@/lib/server/db';
import { updateBooking } from '@/lib/server/bookings';
import { api, HttpError, jsonBody, stringField } from '@/lib/server/http';

async function summary(showtimeId) {
    const db = await getDb();
    const showtime = await db.prepare('SELECT s.id,s.start_time,r.name AS room_name,m.title AS movie_title,m.duration FROM showtimes s JOIN rooms r ON r.id=s.room_id JOIN movies m ON m.id=s.movie_id WHERE s.id=?').bind(showtimeId).first();
    if (!showtime) throw new HttpError(404, 'Suất chiếu không tồn tại.');
    const counts = await db.prepare("SELECT status,COUNT(*) AS orders,COALESCE(SUM(json_array_length(seats)),0) AS seats FROM bookings WHERE showtime_id=? GROUP BY status").bind(showtimeId).all();
    const closed = await db.prepare('SELECT value FROM metadata WHERE key=?').bind(`cancelled-showtime:${showtimeId}`).first();
    return { showtime: { id: showtime.id, startTime: showtime.start_time, roomName: showtime.room_name, movieTitle: showtime.movie_title, duration: showtime.duration }, counts: counts.results, closed: Boolean(closed) };
}

export const GET = api(async request => {
    await requireUser(request, ['admin']);
    const showtimeId = stringField(new URL(request.url).searchParams.get('showtimeId'), 'Suất chiếu', 1, 100);
    return Response.json(await summary(showtimeId));
});

export const POST = api(async request => {
    const admin = await requireUser(request, ['admin']);
    const body = await jsonBody(request);
    const showtimeId = stringField(body.showtimeId, 'Suất chiếu', 1, 100);
    const incidentMessage = body.incidentMessage ? stringField(body.incidentMessage, 'Nội dung sự cố', 10, 1000) : '';
    if (body.confirm !== 'HUY_SUAT_CHIEU') throw new HttpError(400, 'Cần xác nhận hủy toàn bộ vé của suất chiếu.');
    const before = await summary(showtimeId);
    if (Date.parse(before.showtime.startTime) + Number(before.showtime.duration) * 60000 < Date.now())
        throw new HttpError(400, 'Suất chiếu đã kết thúc. Vui lòng xử lý từng trường hợp qua hỗ trợ khách hàng.');
    const db = await getDb();
    await db.prepare("INSERT OR IGNORE INTO metadata(key,value) VALUES (?,?)").bind(`cancelled-showtime:${showtimeId}`,new Date().toISOString()).run();
    const bookings = await db.prepare("SELECT id,status FROM bookings WHERE showtime_id=? AND status IN ('paid','pending','checked_in') ORDER BY created_at,id").bind(showtimeId).all();
    let cancelled = 0, seats = 0;
    for (const booking of bookings.results) {
        try {
            const updated = await updateBooking(admin, booking.id, 'cancel', { incident: true });
            if (updated.status === 'cancelled') {
                cancelled++; seats += updated.seats.length;
                if (incidentMessage && booking.status !== 'pending')
                    await db.prepare("UPDATE email_outbox SET data=json_set(data,'$.incidentMessage',?) WHERE id=? AND kind='cancel' AND status='pending'").bind(incidentMessage,`cancel:${booking.id}`).run();
            }
        } catch (error) {
            if (!(error instanceof HttpError) || error.status !== 409) throw error;
        }
    }
    return Response.json({ cancelled, seats, skipped: before.counts.filter(row => !['paid','pending','checked_in'].includes(row.status)).reduce((sum,row) => sum + Number(row.orders),0), ...await summary(showtimeId) });
});
