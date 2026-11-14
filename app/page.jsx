"use client";
import { useCallback, useEffect, useState } from "react";
import { Film, X, ArrowRight, ShieldCheck, UserRound, BadgeCheck, LoaderCircle } from "lucide-react";
import CustomerApp from "./components/CustomerApp";
import ManagementApp from "./components/ManagementApp";
import { vietnamToday } from "@/lib/membership-rules";
import EmailVerification from './components/EmailVerification';
import './policies/policies.css';
export default function Home() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [authOpen, setAuthOpen] = useState(false);
    const [manage, setManage] = useState(false);
    const [register, setRegister] = useState(false);
    const [authError, setAuthError] = useState("");
    const [busy, setBusy] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [challenge, setChallenge] = useState(null);
    const [acceptedPolicies, setAcceptedPolicies] = useState(false);
    const refresh = useCallback(async () => {
        const response = await fetch("/api/bootstrap", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok)
            throw new Error(result.error || "Không thể tải dữ liệu rạp.");
        setData(result);
        setError("");
    }, []);
    useEffect(() => { refresh().catch(e => setError(e.message)); }, [refresh]);
    useEffect(() => {
        if (!authOpen)
            return;
        const previous = document.activeElement;
        const key = (e) => { if (e.key === "Escape" && !busy)
            setAuthOpen(false); };
        document.addEventListener("keydown", key);
        const timer = setTimeout(() => document.getElementById("auth-email")?.focus(), 50);
        return () => { clearTimeout(timer); document.removeEventListener("keydown", key); previous?.focus(); };
    }, [authOpen, busy]);
    async function authenticate(e) {
        e.preventDefault();
        setBusy(true);
        setAuthError("");
        try {
            const response = await fetch(`/api/auth/${register ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, ...(register ? { name, birthDate, acceptedPolicies } : {}) }) });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error || "Đăng nhập thất bại.");
            if (result.verificationRequired) { setChallenge(result); setPassword(''); return; }
            await refresh();
            setAuthOpen(false);
            setPassword("");
            setManage(result.user?.role === "admin" || result.user?.role === "staff");
        }
        catch (e) {
            setAuthError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
        }
        finally {
            setBusy(false);
        }
    }
    async function logout() {
        try {
            const r = await fetch("/api/auth/logout", { method: "POST" });
            if (!r.ok)
                throw new Error("Đăng xuất thất bại.");
            await refresh();
            setManage(false);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "Không thể đăng xuất.");
        }
    }
    if (!data)
        return <main className="startup"><Film size={44}/><h1>CineStar<span>.</span></h1>{error ? <><p role="alert">{error}</p><button className="primary" onClick={() => refresh().catch(e => setError(e.message))}>Thử lại</button></> : <p><LoaderCircle className="spin" size={18}/> Đang mở thế giới điện ảnh…</p>}</main>;
    return <>
    {error && <div className="app-error" role="alert">{error}<button aria-label="Đóng thông báo" onClick={() => setError("")}><X size={16}/></button></div>}
    {manage && data.user && data.user.role !== "user" ? <ManagementApp user={data.user} data={data} onExit={() => setManage(false)} onLogout={logout} onRefresh={refresh}/> : <CustomerApp user={data.user} data={data} onLogin={() => { setAuthError(""); setAuthOpen(true); }} onManage={() => setManage(true)} onLogout={logout} onRefresh={refresh}/>}
    {authOpen && <div className="auth-overlay" onClick={() => !busy && setAuthOpen(false)}><section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={e => e.stopPropagation()}>
      <button className="auth-close" aria-label="Đóng đăng nhập" onClick={() => setAuthOpen(false)} disabled={busy}><X size={22}/></button>
      <div className="auth-symbol"><Film size={30}/></div><p className="auth-eyebrow">YOUR NEXT GREAT STORY</p><h2 id="auth-title">{register ? "Bắt đầu cùng CineStar" : "Chào mừng trở lại"}</h2><p className="auth-subtitle">Một tài khoản. Cả thế giới điện ảnh.</p>
      {challenge ? <EmailVerification challenge={challenge} onChallenge={setChallenge} onBack={()=>setChallenge(null)} onVerified={async()=>{await refresh();setChallenge(null);setAuthOpen(false);setPassword('');setManage(false);}}/> : <form onSubmit={authenticate}>{register && <label>Họ và tên<input autoComplete="name" required maxLength={80} value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Minh Anh"/></label>}
        <label>Email<input id="auth-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="ban@example.com"/></label>
        <label>Mật khẩu<input type="password" autoComplete={register ? "new-password" : "current-password"} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Tối thiểu 8 ký tự"/></label>
        {register && <label>Ngày sinh<input type="date" autoComplete="bday" min="1900-01-01" max={vietnamToday()} required value={birthDate} onChange={e => setBirthDate(e.target.value)}/><small>Nhập chính xác để nhận ưu đãi sinh nhật. Bạn chỉ được nhập một lần; cần sửa vui lòng liên hệ nhân viên hoặc admin.</small></label>}
        {register && <label className="email-check auth-policy-consent"><input type="checkbox" required checked={acceptedPolicies} onChange={e=>setAcceptedPolicies(e.target.checked)}/><span>Tôi đã đọc và đồng ý với <a href="/policies" target="_blank" rel="noopener noreferrer">các chính sách của CineStar</a> và <a href="/policies/notifications" target="_blank" rel="noopener noreferrer">Chính sách thông báo qua email</a>, bao gồm nhận mã xác minh, thông báo vé, sự cố, ưu đãi và lời chúc sinh nhật. Tôi có thể ngừng nhận email ưu đãi và sinh nhật qua liên kết trong email.</span></label>}
        {authError && <p className="form-error" role="alert">{authError}</p>}<button className="primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : <>{register ? "Gửi mã xác minh" : "Đăng nhập"}<ArrowRight size={18}/></>}</button>
      </form>}<p className="auth-toggle">{register ? "Đã có tài khoản?" : "Chưa có tài khoản?"} <button disabled={busy} onClick={() => { setRegister(!register); setAuthError(""); setChallenge(null); }}>{register ? "Đăng nhập" : "Đăng ký ngay"}</button></p>
      {!register && data.demoAccountsEnabled && <div className="demo-accounts"><span>TRẢI NGHIỆM BA VAI TRÒ</span><div>{[{ role: "user", label: "Khách hàng", icon: UserRound }, { role: "staff", label: "Nhân viên", icon: BadgeCheck }, { role: "admin", label: "Admin", icon: ShieldCheck }].map(item => <button key={item.role} type="button" disabled={busy} onClick={() => { setEmail(`${item.role}@cineverse.vn`); setPassword("Demo@123"); }}><item.icon size={17}/>{item.label}</button>)}</div><small>Chọn vai trò để điền tài khoản demo · mật khẩu Demo@123</small></div>}
    </section></div>}
  </>;
}
