"use client";
import { useEffect, useRef, useState } from "react";
import { Clock3, Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { bookingStatusLabels } from "@/lib/payment-label";
import "./sepay.css";

const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);

export default function SePayPayment({ booking, onUpdate, onClose }) {
    const [current, setCurrent] = useState(booking);
    const [now, setNow] = useState(Date.now());
    const [error, setError] = useState("");
    const [copied, setCopied] = useState("");
    const [busy, setBusy] = useState(false);
    const [imageError, setImageError] = useState(false);
    const callback = useRef(onUpdate);
    callback.current = onUpdate;
    const active = useRef(true);
    const reading = useRef(false);
    const offset = useRef((booking.serverNow || Date.now()) - Date.now());

    async function refresh() {
        if (reading.current) return;
        reading.current = true;
        try {
            const response = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Chưa kiểm tra được thanh toán.");
            if (!active.current) return;
            offset.current = result.booking.serverNow - Date.now();
            setCurrent(result.booking);
            setError("");
            if (result.booking.status !== "pending") callback.current?.(result.booking);
        } catch (caught) {
            if (active.current) setError(`${caught.message} Hệ thống sẽ tiếp tục kiểm tra. Bạn có thể mở lại đơn trong Vé của tôi.`);
        } finally { reading.current = false; }
    }
    const refreshRef = useRef(refresh);
    refreshRef.current = refresh;
    useEffect(() => {
        active.current = true;
        const tick = window.setInterval(() => setNow(Date.now()), 1000);
        const poll = window.setInterval(() => void refreshRef.current(), 3000);
        void refreshRef.current();
        return () => { active.current = false; window.clearInterval(tick); window.clearInterval(poll); };
    }, [booking.id]);
    const remaining = Math.max(0, Math.ceil((current.expiresAt - now - offset.current) / 1000));
    const countdown = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
    async function copy(value, label) {
        try { await navigator.clipboard.writeText(value); setCopied(label); }
        catch { setError("Không sao chép được. Bạn có thể chọn và sao chép thông tin bên dưới."); }
    }
    async function cancel() {
        if (busy) return;
        setBusy(true);
        try {
            const response = await fetch(`/api/bookings/${booking.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Chưa hủy được đơn.");
            if (active.current) { setCurrent(result.booking); callback.current?.(result.booking); }
        } catch (caught) { if (active.current) setError(caught.message); }
        finally { if (active.current) setBusy(false); }
    }
    const payment = current.payment;
    return <div className="cv-sepay">
        <span className="cv-section-kicker">CINESTAR · VIETQR</span>
        <h2>{bookingStatusLabels[current.status]}</h2>
        <p>{current.movieTitle} · Ghế {current.seats.join(", ")}</p>
        {current.status === "pending" && remaining > 0 && payment ? <>
            <div className={`cv-sepay-timer ${remaining <= 60 ? "urgent" : ""}`} role="status"><Clock3 size={18}/> Giữ ghế còn <strong>{countdown}</strong></div>
            {!imageError ? <img className="cv-sepay-qr" src={payment.qrUrl} alt={`QR chuyển khoản ${money(payment.amount)}, nội dung ${payment.content}`} onError={() => setImageError(true)}/> : <p className="cv-error">Chưa tải được ảnh QR. Bạn có thể chuyển khoản theo thông tin bên dưới.</p>}
            <dl className="cv-sepay-details">
                <div><dt>Ngân hàng</dt><dd>{payment.bank}</dd></div>
                <div><dt>Người nhận</dt><dd>{payment.accountName}</dd></div>
                <div><dt>Số tài khoản</dt><dd>{payment.account}<button aria-label="Sao chép số tài khoản" onClick={() => copy(payment.account, "số tài khoản")}><Copy size={15}/></button></dd></div>
                <div><dt>Số tiền</dt><dd className="cv-sepay-amount">{money(payment.amount)}</dd></div>
                <div><dt>Nội dung</dt><dd>{payment.content}<button aria-label="Sao chép nội dung chuyển khoản" onClick={() => copy(payment.content, "nội dung")}><Copy size={15}/></button></dd></div>
            </dl>
            {copied && <p role="status">Đã sao chép {copied}.</p>}
            <p className="cv-sepay-note"><ShieldCheck size={17}/> Quét bằng ứng dụng ngân hàng. Giữ nguyên số tiền và nội dung; vé sẽ xuất hiện sau khi hệ thống xác nhận tiền vào.</p>
            <p className="cv-sepay-note">Nếu đã chuyển tiền, hãy chờ xác nhận và không chuyển lại. Bạn có thể đóng cửa sổ và mở lại tại Vé của tôi.</p>
        </> : <p role="status">{current.status === "pending" ? "Đã hết thời gian chuyển khoản. Đang kiểm tra trạng thái đơn…" : "Đơn không còn chờ thanh toán. Nếu đã chuyển tiền nhưng chưa nhận vé, liên hệ rạp kèm mã đơn và biên lai để đối soát."}</p>}
        {error && <p className="cv-error" role="alert">{error}</p>}
        <div className="cv-sepay-actions"><button className="cv-btn cv-btn-outline" disabled={busy} onClick={() => void refresh()}><RefreshCw size={16}/> Kiểm tra thanh toán</button><button className="cv-btn cv-btn-primary" disabled={busy} onClick={onClose}>Đóng</button></div>
        {current.status === "pending" && <button className="cv-cancel-link" disabled={busy} onClick={cancel}>{busy ? "Đang hủy…" : "Chưa chuyển tiền — hủy đơn và trả ghế"}</button>}
    </div>;
}
