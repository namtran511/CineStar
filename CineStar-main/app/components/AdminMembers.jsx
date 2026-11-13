"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Gift, Pencil, Plus, RefreshCw, Search, ShieldCheck, Trash2, X } from "lucide-react";
import { vietnamToday } from "@/lib/membership-rules";
import "./admin-members.css";
import { GrantPointsButton } from "./MemberOperations";

async function request(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options, headers: { "Content-Type": "application/json", ...options.headers } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Không thể thực hiện thao tác.");
    return body;
}
const dob = date => date ? date.split("-").reverse().join("/") : "Chưa bổ sung";
const roleLabel = role => ({ user: "Khách hàng", staff: "Nhân viên", admin: "Admin" })[role];

export function MemberDialog({ title, onClose, busy, children }) {
    const ref = useRef(null);
    const latest = useRef({ onClose, busy }); latest.current = { onClose, busy };
    useEffect(() => {
        const before = document.activeElement;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        ref.current?.focus();
        const key = event => {
            if (event.key === "Escape" && !latest.current.busy) latest.current.onClose();
            if (event.key !== "Tab") return;
            const nodes = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];
            if (!nodes.length) { event.preventDefault(); return; }
            const current = document.activeElement;
            if (!nodes.includes(current) || (event.shiftKey && current === nodes[0]) || (!event.shiftKey && current === nodes.at(-1))) {
                event.preventDefault(); (event.shiftKey ? nodes.at(-1) : nodes[0]).focus();
            }
        };
        document.addEventListener("keydown", key);
        return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", key); before?.focus(); };
    }, []);
    return <div className="mg-overlay" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}><div className="mg-modal" ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}><div className="mg-modal-head"><h2>{title}</h2><button className="mg-icon-button" disabled={busy} onClick={onClose} aria-label="Đóng"><X size={20}/></button></div>{children}</div></div>;
}

export function AccountsPanel({ users, currentUser, search, onChanged }) {
    const [editor, setEditor] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const filtered = users.filter(item => [item.name, item.email, item.cardNumber, item.tier?.name].join(" ").toLocaleLowerCase("vi-VN").includes(search.trim().toLocaleLowerCase("vi-VN")));
    const open = user => { setError(""); setEditor({ id: user?.id, name: user?.name || "", email: user?.email || "", role: user?.role || "user", birthDate: user?.birthDate || "", password: "" }); };
    const update = event => setEditor(old => ({ ...old, [event.target.name]: event.target.value }));
    const finish = async text => {
        setNotice(text);
        try { await onChanged(); } catch { setNotice(`${text} Hãy tải lại danh sách để xem dữ liệu mới.`); }
    };
    const save = async event => {
        event.preventDefault(); if (busy) return;
        setBusy(true); setError("");
        try {
            const { id, password, birthDate, ...body } = editor;
            await request(`/api/admin/users${id ? `/${id}` : ""}`, { method: id ? "PATCH" : "POST", body: JSON.stringify({ ...body, ...(password ? { password } : {}), ...(birthDate ? { birthDate } : {}) }) });
            setEditor(null); await finish(id ? "Đã cập nhật tài khoản." : "Đã tạo tài khoản.");
        } catch (failure) { setError(failure.message); } finally { setBusy(false); }
    };
    const remove = async () => {
        if (busy) return;
        setBusy(true); setError("");
        try { await request(`/api/admin/users/${deleting.id}`, { method: "DELETE" }); setDeleting(null); await finish("Đã xóa tài khoản khỏi danh sách hoạt động."); }
        catch (failure) { setError(failure.message); } finally { setBusy(false); }
    };
    return <section className="mg-member-admin">
        <div className="mg-member-actions"><p><ShieldCheck size={17}/> Quản lý tài khoản, ngày sinh, hạng và điểm thành viên.</p><button className="mg-primary" onClick={() => open()}><Plus size={17}/> Thêm tài khoản</button></div>
        {notice && <p className="mg-alert mg-alert-success" role="status">{notice}</p>}
        <div className="mg-card mg-table-wrap"><table className="mg-table"><thead><tr><th>Tài khoản</th><th>Ngày sinh</th><th>Vai trò / Hạng</th><th>Điểm khả dụng</th><th>Tổng điểm tích</th><th>Thao tác</th></tr></thead><tbody>{filtered.map(item => <tr key={item.id}><td><strong>{item.name}{item.id === currentUser.id ? " (Bạn)" : ""}</strong><small>{item.email}</small>{item.role === "user" && <small className="mg-member-card-code">{item.cardNumber}</small>}</td><td>{dob(item.birthDate)}</td><td><span className="mg-badge mg-badge-muted">{roleLabel(item.role)}</span>{item.role === "user" && <small>{item.tier?.name || "Thành viên"}</small>}</td><td><strong className="mg-accent">{item.role === "user" ? item.points : "—"}</strong></td><td>{item.role === "user" ? item.lifetimePoints : "—"}</td><td><div className="mg-row-actions">{item.role === "user" && <GrantPointsButton user={item} onChanged={onChanged} Dialog={MemberDialog}/>}<button className="mg-icon-button" aria-label={`Chỉnh sửa ${item.email}`} onClick={() => open(item)}><Pencil size={16}/></button><button className="mg-icon-button mg-delete" disabled={item.id === currentUser.id} aria-label={`Xóa ${item.email}`} onClick={() => { setError(""); setDeleting(item); }}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table>{!filtered.length && <p className="mg-empty">Không tìm thấy tài khoản.</p>}</div>
        {editor && <MemberDialog title={editor.id ? "Chỉnh sửa tài khoản" : "Thêm tài khoản"} onClose={() => setEditor(null)} busy={busy}><form onSubmit={save}><div className="mg-form-fields">
            <label className="mg-field">Họ và tên<input name="name" value={editor.name} onChange={update} required minLength={2} maxLength={100}/></label>
            <label className="mg-field">Email<input name="email" type="email" value={editor.email} onChange={update} required maxLength={254}/></label>
            <label className="mg-field">Vai trò<select name="role" value={editor.role} onChange={update}><option value="user">Khách hàng</option><option value="staff">Nhân viên</option><option value="admin">Admin</option></select></label>
            <label className="mg-field">Ngày sinh<input name="birthDate" type="date" min="1900-01-01" max={vietnamToday()} value={editor.birthDate} onChange={update} required={editor.role === "user"}/><small>Admin được chỉnh ngày sinh. Khách hàng chỉ nhập một lần.</small></label>
            <label className="mg-field mg-full">{editor.id ? "Mật khẩu mới (không đổi thì để trống)" : "Mật khẩu"}<input name="password" type="password" autoComplete="new-password" value={editor.password} onChange={update} required={!editor.id} minLength={8} maxLength={128}/></label>
        </div><p className="mg-form-note">Điểm được hệ thống tính từ giao dịch. Đổi email, mật khẩu hoặc vai trò sẽ yêu cầu tài khoản đăng nhập lại.</p>{error && <p className="mg-alert mg-alert-error" role="alert">{error}</p>}<div className="mg-modal-actions"><button type="button" className="mg-secondary" disabled={busy} onClick={() => setEditor(null)}>Hủy</button><button className="mg-primary" type="submit" disabled={busy}><Check size={16}/>{busy ? "Đang lưu…" : "Lưu tài khoản"}</button></div></form></MemberDialog>}
        {deleting && <MemberDialog title="Xóa tài khoản" onClose={() => setDeleting(null)} busy={busy}><p className="mg-confirm-description">Xóa tài khoản <strong>{deleting.email}</strong>? Tài khoản sẽ không thể đăng nhập. Vé, đánh giá và lịch sử điểm được giữ lại.</p>{error && <p className="mg-alert mg-alert-error" role="alert">{error}</p>}<div className="mg-modal-actions"><button className="mg-secondary" disabled={busy} onClick={() => setDeleting(null)}>Quay lại</button><button className="mg-primary" disabled={busy} onClick={remove}>{busy ? "Đang xóa…" : "Xác nhận xóa"}</button></div></MemberDialog>}
    </section>;
}

export function RewardsPanel() {
    const [rewards, setRewards] = useState([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const load = async signal => { setLoading(true); setError(""); try { const result = await request("/api/admin/rewards", { signal }); setRewards(result.rewards); } catch (failure) { if (failure.name !== "AbortError") setError(failure.message); } finally { if (!signal?.aborted) setLoading(false); } };
    useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, []);
    const fulfill = async () => {
        if (busy) return; setBusy(true); setError("");
        try { await request(`/api/admin/rewards/${selected.id}`, { method: "PATCH", body: JSON.stringify({ action: "fulfill" }) }); setSelected(null); setNotice("Đã xác nhận giao quà. Mã này không thể sử dụng lần nữa."); await load(); }
        catch (failure) { setError(failure.message); } finally { setBusy(false); }
    };
    const list = rewards.filter(item => [item.code, item.name, item.customerName, item.customerEmail].join(" ").toLocaleLowerCase("vi-VN").includes(search.trim().toLocaleLowerCase("vi-VN")));
    return <section className="mg-member-admin"><div className="mg-member-actions"><p><Gift size={18}/> Đối chiếu mã và tài khoản trước khi giao quà hoặc combo.</p><button className="mg-secondary" onClick={() => load()} disabled={loading}><RefreshCw size={15}/> Tải lại</button></div><label className="mg-search"><Search size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm mã quà, tên hoặc email khách" aria-label="Tìm mã đổi quà"/></label>{notice && <p className="mg-alert mg-alert-success" role="status">{notice}</p>}{error && !selected && <p className="mg-alert mg-alert-error" role="alert">{error}<button onClick={() => load()}>Thử lại</button></p>}<div className="mg-card mg-table-wrap"><table className="mg-table"><thead><tr><th>Mã nhận quà</th><th>Khách hàng</th><th>Quà / Điểm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{list.map(reward => <tr key={reward.id}><td><strong className="mg-accent">{reward.code}</strong></td><td>{reward.customerName}<small>{reward.customerEmail}</small></td><td>{reward.name}<small>{reward.pointsCost} điểm</small></td><td><span className="mg-badge mg-badge-muted">{{ available: "Chưa sử dụng", used: "Đã dùng đặt vé", fulfilled: "Đã nhận quà" }[reward.status]}</span></td><td>{reward.status === "available" && reward.type !== "ticket" ? <button className="mg-small-button" onClick={() => { setError(""); setSelected(reward); }}><Gift size={15}/> Giao quà</button> : reward.type === "ticket" && reward.status === "available" ? <small>Khách chọn vé thưởng khi thanh toán</small> : "—"}</td></tr>)}</tbody></table>{!list.length && <p className="mg-empty">{loading ? "Đang tải mã nhận quà…" : "Chưa có mã nhận quà phù hợp."}</p>}</div>{selected && <MemberDialog title="Xác nhận giao quà" onClose={() => setSelected(null)} busy={busy}><p className="mg-confirm-description">Giao <strong>{selected.name}</strong> cho {selected.customerName} với mã <strong>{selected.code}</strong>?</p>{error && <p className="mg-alert mg-alert-error" role="alert">{error}</p>}<div className="mg-modal-actions"><button className="mg-secondary" disabled={busy} onClick={() => setSelected(null)}>Quay lại</button><button className="mg-primary" disabled={busy} onClick={fulfill}>{busy ? "Đang xác nhận…" : "Đã giao quà"}</button></div></MemberDialog>}</section>;
}
