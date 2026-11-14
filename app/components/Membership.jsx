"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Cake, Check, Copy, CreditCard, Gift, Sparkles, Ticket, UserRound } from "lucide-react";
import { vietnamToday } from "@/lib/membership-rules";
import "./membership.css";

const money = value => new Intl.NumberFormat("vi-VN").format(value) + "đ";
const date = value => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
async function request(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Không tải được thông tin thành viên.");
    return result;
}

export function MembershipNotice({ membership, onOpen }) {
    if (!membership?.birthday.active || membership.birthday.used) return null;
    return <div className="cv-member-birthday-banner"><Cake size={20}/><p><strong>Mừng sinh nhật bạn!</strong> Ưu đãi giảm 20% một đơn đang chờ bạn, đến {date(membership.birthday.endsOn)}.</p><button onClick={onOpen}>Xem ưu đãi<ArrowRight size={15}/></button></div>;
}

export function MembershipCheckout({ membership, subtotal, promotionCode, value, onChange, ticketPrice = 0, seatCount = 0 }) {
    if (!membership) return null;
    const max = Math.min(membership.points, Math.floor(subtotal * .3 / 1000));
    const vouchers = membership.redemptions.filter(reward => reward.type === "ticket" && reward.status === "available");
    const selected = value.rewardIds || [];
    const maxTickets = Math.min(vouchers.length, seatCount);
    const mode = value.useBirthday ? "birthday" : selected.length && maxTickets > 0 ? "ticket" : value.redeemPoints > 0 ? "points" : "none";
    const choose = next => onChange({ redeemPoints: next === "points" ? Math.min(max, 1) : 0, useBirthday: next === "birthday", rewardIds: next === "ticket" ? vouchers.slice(0, 1).map(reward => reward.id) : [] });
    return <fieldset className="cv-member-checkout" disabled={Boolean(promotionCode)}><legend><CreditCard size={16}/> Ưu đãi thành viên · {membership.points} điểm</legend><p>{promotionCode ? "Bỏ mã ưu đãi để sử dụng điểm, sinh nhật hoặc vé thưởng." : "Mỗi đơn áp dụng một loại ưu đãi."}</p><label>Chọn ưu đãi<select value={promotionCode ? "none" : mode} onChange={event => choose(event.target.value)}><option value="none">Không dùng ưu đãi thành viên</option><option value="points" disabled={max < 1}>Dùng điểm (tối đa {max} điểm)</option><option value="birthday" disabled={!membership.birthday.active || membership.birthday.used}>Sinh nhật · giảm 20%{membership.birthday.used ? " · đã dùng" : ""}</option><option value="ticket" disabled={!maxTickets}>Vé thưởng · tối đa {maxTickets} ghế</option></select></label>{mode === "points" && !promotionCode && <label>Số điểm muốn dùng<input type="number" min={0} max={max} step={1} value={value.redeemPoints} onChange={e => onChange({ ...value, redeemPoints: Math.min(max, Math.max(0, Math.floor(Number(e.target.value) || 0))) })}/><small>1 điểm = 1.000đ · tối đa 30% đơn.</small></label>}{mode === "ticket" && !promotionCode && <label>Số vé thưởng muốn dùng<select value={Math.min(selected.length, maxTickets)} onChange={event => onChange({ ...value, rewardIds: vouchers.slice(0, Number(event.target.value)).map(reward => reward.id) })}>{Array.from({ length: maxTickets }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} vé · giảm {money(ticketPrice * (index + 1))}</option>)}</select><small>Mỗi vé giảm giá một ghế; combo thanh toán riêng.</small></label>}<p>Điểm mới được cộng khi soát vé, theo số tiền thực trả.</p></fieldset>;
}

function MemberContent({ user, onLogin, onRefresh, onExplore }) {
    const [membership, setMembership] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [confirm, setConfirm] = useState(null);
    const confirmRef = useRef(null);
    useEffect(() => {
        if (confirm) { confirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); confirmRef.current?.focus({ preventScroll: true }); }
    }, [confirm]);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState("");
    const mounted = useRef(true);
    const controllerRef = useRef(null);
    const load = async () => {
        if (user?.role !== "user") { setLoading(false); return; }
        controllerRef.current?.abort();
        const controller = new AbortController(); controllerRef.current = controller;
        setLoading(true); setError("");
        try { const result = await request("/api/membership/me", { signal: controller.signal }); if (!controller.signal.aborted && mounted.current) setMembership(result.membership); }
        catch (failure) { if (failure.name !== "AbortError" && mounted.current) setError(failure.message); }
        finally { if (mounted.current && !controller.signal.aborted) setLoading(false); }
    };
    useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; controllerRef.current?.abort(); }; }, []);
    const mutate = async (url, method, body) => {
        if (busy) return; setBusy(true); setError(""); setNotice("");
        try {
            const result = await request(url, { method, body: JSON.stringify(body) });
            if (!mounted.current) return;
            setMembership(result.membership); setConfirm(null);
            setNotice(method === "PATCH" ? "Đã lưu ngày sinh. Liên hệ nhân viên hoặc admin nếu cần điều chỉnh." : "Đã đổi điểm thành công. Mã nhận quà nằm trong ví ưu đãi bên dưới.");
            try { await onRefresh(); } catch { if (mounted.current) setNotice("Thông tin đã lưu. Tải lại trang để đồng bộ số điểm ở thanh toán."); }
        } catch (failure) { if (mounted.current) setError(failure.message); }
        finally { if (mounted.current) setBusy(false); }
    };
    const copy = async code => { try { await navigator.clipboard.writeText(code); setCopied(code); } catch { setNotice("Hãy chọn và sao chép mã trực tiếp trong ví ưu đãi."); } };
    const next = membership?.tier.nextAt;
    return <main className="cv-container cv-inner-page cv-membership"><div className="cv-page-heading"><div className="cv-section-kicker">CINESTAR MEMBERS CLUB</div><h1>Mỗi cuộc hẹn, thêm đặc quyền.</h1><p>Thẻ thành viên, điểm tích lũy và những món quà dành riêng cho bạn.</p></div>
        {!user ? <div className="cv-empty"><UserRound size={34}/><h2>Đăng nhập để xem thẻ thành viên</h2><button className="cv-btn cv-btn-primary" onClick={onLogin}>Đăng nhập</button></div> : user.role !== "user" ? <p>Chương trình thành viên dành cho tài khoản khách hàng.</p> : <>
            {error && <div className="cv-error" role="alert">{error}<button onClick={load} disabled={busy}>Tải lại</button></div>}{notice && <p className="cv-member-success" role="status"><Check size={17}/>{notice}</p>}
            {loading && !membership ? <div className="cv-empty" role="status">Đang tải thẻ thành viên…</div> : membership && <>
                <div className="cv-member-overview"><section className="cv-member-card" aria-label="Thẻ thành viên"><div><strong>CineStar<span> CLUB</span></strong><CreditCard size={26}/></div><span className="cv-member-tier"><Sparkles size={15}/>{membership.tier.name}</span><h2>{user.name}</h2><code>{membership.cardNumber}</code><div className="cv-member-card-bottom"><span>MEMBER SINCE YOUR FIRST STORY</span><Ticket size={24}/></div></section><section className="cv-member-balance"><span>ĐIỂM KHẢ DỤNG</span><strong>{membership.points}<small> điểm</small></strong><p>Đã tích lũy tổng cộng {membership.lifetimePoints} điểm.</p><progress max={next || 1000} value={Math.min(membership.lifetimePoints, next || 1000)} aria-label="Tiến độ hạng thành viên"/><p>{next ? `Còn ${Math.max(0, next - membership.lifetimePoints)} điểm tích lũy để lên hạng ${membership.tier.nextName}.` : "Bạn đang ở hạng thành viên cao nhất."}</p><small>Thành viên → Bạc: 100 · Vàng: 300 · Kim cương: 1.000 điểm.<br/>Đổi điểm không làm giảm hạng.</small></section></div>
                <section className="cv-member-birthday"><Cake size={27}/><div><h2>Đặc quyền sinh nhật</h2>{membership.birthDate ? <><p>Ngày sinh: <strong>{date(membership.birthDate)}</strong> · Liên hệ nhân viên hoặc admin nếu cần sửa.</p><p>{membership.birthday.used ? "Bạn đã sử dụng ưu đãi sinh nhật kỳ này." : membership.birthday.active ? "Ưu đãi của bạn đang có hiệu lực: giảm 20% một đơn khi thanh toán." : "Giảm 20% một đơn trong 10 ngày trước đến 10 ngày sau sinh nhật."}</p><small>Thời gian: {date(membership.birthday.startsOn)} – {date(membership.birthday.endsOn)}. Không cộng dồn ưu đãi khác.</small>{membership.birthday.active && !membership.birthday.used && <button className="cv-text-link" onClick={onExplore}>Chọn phim và nhận ưu đãi<ArrowRight size={15}/></button>}</> : <form onSubmit={event => { event.preventDefault(); setConfirm({ type: "birthday", birthDate }); }}><p>Bổ sung ngày sinh để nhận thông báo ưu đãi. Bạn chỉ được nhập một lần.</p><label>Ngày sinh<input type="date" required min="1900-01-01" max={vietnamToday()} value={birthDate} onChange={e => setBirthDate(e.target.value)}/></label><button className="cv-btn cv-btn-outline" disabled={busy}>Lưu ngày sinh</button></form>}</div></section>
                <div className="cv-member-section-heading"><div><h2>Đổi điểm, thêm niềm vui.</h2><p>Chọn quà, combo hoặc vé xem phim.</p></div><Gift size={24}/></div><div className="cv-member-rewards">{membership.rewards.map(reward => <article key={reward.key}><span className="cv-member-reward-icon">{reward.type === "ticket" ? <Ticket size={29}/> : <Gift size={29}/>}</span><h3>{reward.name}</h3><p>{reward.description}</p><strong>{reward.pointsCost} điểm</strong><button className="cv-btn cv-btn-outline" disabled={busy || membership.points < reward.pointsCost} onClick={() => setConfirm({ type: "reward", reward })}>{membership.points < reward.pointsCost ? "Chưa đủ điểm" : "Đổi quà"}<ArrowRight size={15}/></button></article>)}</div>
                {confirm && <section ref={confirmRef} tabIndex={-1} className="cv-member-confirm" role="region" aria-label="Xác nhận thông tin"><h3>{confirm.type === "birthday" ? `Lưu ngày sinh ${date(confirm.birthDate)}?` : `Dùng ${confirm.reward.pointsCost} điểm đổi ${confirm.reward.name}?`}</h3><p>{confirm.type === "birthday" ? "Bạn không thể tự đổi lại ngày sinh sau khi xác nhận." : "Điểm được trừ ngay. Quà và combo nhận tại quầy; vé thưởng chọn ở bước thanh toán."}</p><div><button className="cv-btn cv-btn-primary" disabled={busy} onClick={() => confirm.type === "birthday" ? mutate("/api/membership/me", "PATCH", { birthDate: confirm.birthDate }) : mutate("/api/membership/redeem", "POST", { rewardKey: confirm.reward.key })}>{busy ? "Đang xử lý…" : "Xác nhận"}</button><button className="cv-btn cv-btn-outline" disabled={busy} onClick={() => setConfirm(null)}>Hủy</button></div></section>}
                <section className="cv-member-wallet"><h2>Ví ưu đãi của bạn</h2><p>Đưa mã cho nhân viên tại quầy để nhận quà hoặc combo. Vé thưởng dùng khi đặt vé trên website.</p>{membership.redemptions.length ? <div className="cv-member-voucher-list">{membership.redemptions.map(reward => <article key={reward.id}><div><strong>{reward.name}</strong><small>{reward.pointsCost} điểm · {date(reward.createdAt)}</small></div><span className={`cv-member-status ${reward.status}`}>{{ available: "Sẵn sàng sử dụng", used: "Đã dùng đặt vé", fulfilled: "Đã nhận quà" }[reward.status]}</span><code>{reward.code}</code><button disabled={reward.status !== "available"} onClick={() => copy(reward.code)} aria-label={`Sao chép mã ${reward.name}`}>{copied === reward.code ? <Check size={16}/> : <Copy size={16}/>}</button></article>)}</div> : <p className="cv-member-empty">Chưa có quà đã đổi. Tích điểm từ những lần xem phim tiếp theo nhé.</p>}</section>
                <section className="cv-member-transactions"><h2>Lịch sử điểm</h2><p>100 giao dịch gần nhất.</p>{membership.transactions.length ? <ul>{membership.transactions.map(item => <li key={item.id}><div><strong>{item.description}</strong><small>{date(item.createdAt)}</small></div><b className={item.delta > 0 ? "credit" : "debit"}>{item.delta > 0 ? "+" : ""}{item.delta} điểm</b></li>)}</ul> : <p className="cv-member-empty">Chưa có giao dịch điểm.</p>}</section>
                <p className="cv-member-rules">Cứ 10.000đ thực trả tích 1 điểm khi soát vé. Dùng 1 điểm giảm 1.000đ, tối đa 30% đơn. Hủy vé hợp lệ sẽ hoàn điểm đã dùng và mở lại ưu đãi. Mỗi đơn chỉ dùng một loại ưu đãi; hạng tính theo tổng điểm đã tích.</p>
            </>}
        </>}
    </main>;
}
export default function Membership(props) { return <MemberContent key={`${props.user?.id || "guest"}:${props.user?.role}`} {...props}/>; }
