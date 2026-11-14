"use client";
import { useState } from "react";

const when = value => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function AdminCancelShowtime({ data, onCancelled }) {
    const [showtimeId, setShowtimeId] = useState("");
    const [preview, setPreview] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const choices = data.showtimes.filter(show => Date.parse(show.startTime) + (data.movies.find(movie => movie.id === show.movieId)?.duration || 0) * 60000 >= Date.now()).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
    const affected = preview?.counts.filter(row => ["paid", "pending", "checked_in"].includes(row.status)) || [];
    const orderCount = affected.reduce((sum, row) => sum + Number(row.orders), 0);
    const seatCount = affected.reduce((sum, row) => sum + Number(row.seats), 0);

    async function request(url, options) {
        const response = await fetch(url, options);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Không thể xử lý suất chiếu.");
        return result;
    }
    async function run(task) {
        setBusy(true);
        setError("");
        try { await task(); }
        catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể xử lý suất chiếu."); }
        finally { setBusy(false); }
    }

    return <section className="mg-card mg-cancel-showtime">
        <div><h2>Hủy cả suất chiếu khi gặp sự cố</h2><p>Chọn đúng suất chiếu trong phòng bị sự cố. Hệ thống hủy các đơn chờ thanh toán, đã thanh toán và đã soát; mỗi ghế của đơn đã thanh toán hoặc đã soát được hoàn một vé. Suất này sẽ ngừng nhận đặt vé mới.</p></div>
        <div className="mg-cancel-showtime-actions"><label className="mg-field"><span>Suất chiếu · phòng</span><select value={showtimeId} disabled={busy} onChange={event => { setShowtimeId(event.target.value); setPreview(null); setError(""); }}><option value="">Chọn suất chiếu</option>{choices.map(show => <option key={show.id} value={show.id}>{data.movies.find(movie => movie.id === show.movieId)?.title || "Phim"} · {when(show.startTime)} · {data.rooms.find(room => room.id === show.roomId)?.name || "Phòng"}</option>)}</select></label><button type="button" className="mg-secondary" disabled={busy || !showtimeId} onClick={() => void run(async () => setPreview(await request(`/api/admin/incidents/cancel?showtimeId=${encodeURIComponent(showtimeId)}`)))}>Xem số vé</button></div>
        {preview && <div className="mg-cancel-showtime-preview"><strong>{preview.showtime.movieTitle} · {preview.showtime.roomName}</strong><p>{when(preview.showtime.startTime)} · {orderCount} đơn / {seatCount} ghế sẽ hủy{preview.closed ? " · Suất đã ngừng bán" : ""}</p><button type="button" className="mg-primary" disabled={busy || !orderCount} onClick={() => void run(async () => { const result = await request("/api/admin/incidents/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showtimeId, confirm: "HUY_SUAT_CHIEU", reason: "Sự cố suất chiếu" }) }); setPreview(null); setShowtimeId(""); await onCancelled(result); })}>{busy ? "Đang hủy…" : `Xác nhận hủy ${orderCount} đơn`}</button></div>}
        {error && <div className="mg-alert mg-alert-error" role="alert">{error}</div>}
    </section>;
}
