"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import "./sepay.css";

const outcomes = { paid: "Đã khớp đơn", amount_mismatch: "Sai số tiền — cần đối soát", late_payment: "Tiền đến sau hạn/hủy — cần đối soát", extra_payment: "Chuyển thêm lần nữa — cần đối soát", unmatched: "Không tìm thấy đơn", wrong_account: "Sai tài khoản nhận", wrong_bank: "Sai ngân hàng nhận", wrong_provider: "Đơn không dùng SePay", outgoing: "Tiền ra" };
const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
export default function AdminPayments() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [refund, setRefund] = useState(null);
    const [reason, setReason] = useState("");
    const load = useCallback(async () => {
        setBusy(true);
        try {
            const response = await fetch("/api/admin/payments", { cache: "no-store" });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error);
            setData(body); setError("");
        } catch (caught) { setError(caught.message); }
        finally { setBusy(false); }
    }, []);
    useEffect(() => { void load(); }, [load]);
    async function recordRefund(event) {
        event.preventDefault();
        setBusy(true);
        try {
            const response = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "record_refund", bookingId: refund.id, reason }) });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error);
            setRefund(null); setReason(""); await load();
        } catch (caught) { setError(caught.message); }
        finally { setBusy(false); }
    }
    return <div className="mg-payments">
        <div className="mg-toolbar"><h2>Thanh toán SePay</h2><button className="mg-small-button" onClick={load} disabled={busy}><RefreshCw size={16}/>Cập nhật</button></div>
        {error && <div className="mg-alert mg-alert-error" role="alert">{error}</div>}
        {data && <>
            <p>{data.configuration.mode === "demo" ? "Môi trường mô phỏng." : data.configuration.configured ? "SePay đã có cấu hình nhận giao dịch." : "Cần cấu hình SePay và Secret Key trên Cloudflare để mở thanh toán online."}</p>
            <section className="mg-card"><div className="mg-card-title"><h2>Đơn hủy đang chờ hoàn tiền</h2></div>
                <p>Hoàn tiền bằng ngân hàng sau khi đối chiếu với khách. Nút bên dưới chỉ lưu xác nhận và nhật ký, không thực hiện chuyển tiền.</p>
                {data.refunds.length ? <div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Mã đơn</th><th>Số tiền</th><th>Xử lý</th></tr></thead><tbody>{data.refunds.map(item => <tr key={item.id}><td>{item.code}</td><td>{money(item.total)}</td><td><button className="mg-small-button" disabled={busy} onClick={() => { setRefund(item); setReason(""); }}>Ghi nhận đã hoàn tiền</button></td></tr>)}</tbody></table></div> : <p>Không có đơn chờ hoàn tiền.</p>}
                {refund && <form onSubmit={recordRefund}><h3>Ghi nhận hoàn tiền {refund.code} · {money(refund.total)}</h3><label className="mg-field"><span>Thông tin giao dịch hoàn tiền đã thực hiện</span><textarea required minLength={10} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ngân hàng, mã giao dịch, thời gian hoàn tiền…"/></label><button className="mg-primary" disabled={busy}>Lưu xác nhận</button><button type="button" className="mg-small-button" disabled={busy} onClick={() => setRefund(null)}>Đóng</button></form>}
            </section>
            <section className="mg-card"><div className="mg-card-title"><h2>100 giao dịch webhook gần nhất</h2></div><p>Tiền sai số tiền, sai mã, chuyển thêm hoặc đến sau hạn cần đối soát trước khi xử lý với khách.</p>
                <div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>SePay ID / thời gian</th><th>Mã đơn</th><th>Số tiền</th><th>Kết quả</th></tr></thead><tbody>{data.events.map(item => <tr key={item.transaction_id}><td>{item.transaction_id}<small>{new Date(item.received_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</small></td><td>{item.code || "Không có mã"}</td><td>{money(item.amount)}</td><td>{outcomes[item.outcome] || item.outcome}</td></tr>)}</tbody></table>{!data.events.length && <p>Chưa nhận được giao dịch.</p>}</div>
            </section>
        </>}
    </div>;
}
