"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, CheckCircle2, ChevronRight, CircleDollarSign, Clapperboard, Clock3, Copy, CreditCard, Film, LayoutDashboard, LogOut, Menu, Minus, Pencil, Plus, RefreshCw, Search, ShieldCheck, Ticket, Trash2, Users, Utensils, X } from "lucide-react";
import "./management.css";
import AdminAnalytics from "./AdminAnalytics";
import { StaffMembers } from "./MemberOperations";
import AuditLog from "./AuditLog";
import AdminPayments from "./AdminPayments";
import { bookingStatusLabels, bookingPaymentLabel } from "@/lib/payment-label";
import AdminEmail from './AdminEmail';
import { AccountsPanel, RewardsPanel, MemberDialog } from "./AdminMembers";
import { movieRatingLabel } from "@/lib/movie-rating";
import { useSeatHold } from "@/hooks/use-seat-hold";
const titles = { payments: "Thanh toán SePay", email:'Thông báo email', overview: "Tổng quan", movies: "Quản lý phim", showtimes: "Lịch chiếu", rooms: "Phòng chiếu", combos: "Bắp & nước", promotions: "Ưu đãi", users: "Tài khoản", bookings: "Đơn vé & soát vé", pos: "Bán vé tại quầy", rewards: "Quà thành viên", members: "Khách hàng", audit: "Nhật ký thay đổi" };
const singular = { payments: "giao dịch thanh toán", email:'thông báo email', movies: "phim", showtimes: "suất chiếu", rooms: "phòng chiếu", combos: "combo", promotions: "ưu đãi" };
const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const number = (value) => new Intl.NumberFormat("vi-VN").format(value);
const when = (value) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const time = (value) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const day = (value) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(value));
const inputTime = (value) => new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16);
const roleName = (role) => ({ admin: "Quản trị viên", staff: "Nhân viên", user: "Khách hàng" }[role] || role);
async function request(url, options) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
    const body = await response.json();
    if (!response.ok)
        throw new Error(body.error || "Không thể hoàn tất thao tác. Vui lòng thử lại.");
    return body;
}
function Modal({ title, children, onClose, wide = false }) {
    const ref = useRef(null);
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; }, [onClose]);
    useEffect(() => {
        const oldFocus = document.activeElement;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        ref.current?.focus();
        const key = (event) => {
            if (event.key === "Escape")
                closeRef.current();
            if (event.key !== "Tab")
                return;
            const list = ref.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]');
            if (!list?.length)
                return;
            if (event.shiftKey && document.activeElement === list[0]) {
                event.preventDefault();
                list[list.length - 1].focus();
            }
            else if (!event.shiftKey && document.activeElement === list[list.length - 1]) {
                event.preventDefault();
                list[0].focus();
            }
        };
        document.addEventListener("keydown", key);
        return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", key); oldFocus?.focus(); };
    }, []);
    return <div className="mg-overlay" onMouseDown={event => { if (event.target === event.currentTarget)
        onClose(); }}><div ref={ref} tabIndex={-1} className={`mg-modal ${wide ? "mg-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className="mg-modal-head"><h2>{title}</h2><button className="mg-icon-button" aria-label="Đóng" onClick={onClose}><X size={20}/></button></div>{children}</div></div>;
}
function Empty({ title = "Chưa có dữ liệu", detail = "Dữ liệu mới sẽ xuất hiện tại đây.", icon = <Ticket size={26}/> }) {
    return <div className="mg-empty"><div>{icon}</div><h3>{title}</h3><p>{detail}</p></div>;
}
function Status({ value }) { return <span className={`mg-badge mg-status-${value}`}><i />{bookingStatusLabels[value] || value}</span>; }
export default function ManagementApp({ user, data, onExit, onLogout, onRefresh }) {
    const isAdmin = user.role === "admin";
    const [section, setSection] = useState(isAdmin ? "overview" : "bookings");
    const [sidebar, setSidebar] = useState(false);
    const [analyticsRevision, setAnalyticsRevision] = useState(0);
    const [bookings, setBookings] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("all");
    const [editor, setEditor] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState("");
    const [ticket, setTicket] = useState(null);
    const [copied, setCopied] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const result = await request("/api/bookings");
            setBookings(result.bookings);
            if (isAdmin) {
                const result = await request("/api/admin/users");
                setUsers(result.users);
                setAnalyticsRevision(value => value + 1);
            }
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu.");
        }
        finally {
            setLoading(false);
        }
    }, [isAdmin]);
    useEffect(() => { let active = true; queueMicrotask(() => { if (active)
        void load(); }); return () => { active = false; }; }, [load]);
    useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
    useEffect(() => { if (!notice)
        return; const timer = window.setTimeout(() => setNotice(""), 6000); return () => window.clearTimeout(timer); }, [notice]);
    const refresh = async () => { await onRefresh(); await load(); };
    const navigate = (next) => { setSection(next); setSearch(""); setFilter("all"); setSidebar(false); };
    const openEditor = (resource, values) => {
        const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
        const defaults = {
            movies: { title: "", originalTitle: "", genres: "", duration: 120, ageRating: "T13", poster: "/images/dune.jpg", backdrop: "/images/hero.jpg", description: "", director: "", cast: "", releaseDate: date, status: "now" },
            showtimes: { movieId: data.movies.find(movie => movie.status === "now")?.id || "", roomId: data.rooms[0]?.id || "", startTime: "", price: 90000, format: "2D · Phụ đề" },
            rooms: { name: "", rows: 8, cols: 12, type: "Standard" },
            combos: { name: "", description: "", price: 79000, image: "/images/combo-solo.svg" },
            promotions: { code: "", discountPercent: 10, minTotal: 100000, active: true },
            users: { name: "", role: "user" },
        };
        const next = { ...defaults[resource], ...(values || {}) };
        if (resource === "movies" && values) {
            next.genres = values.genres.join(", ");
            next.cast = values.cast.join(", ");
        }
        if (resource === "showtimes" && values)
            next.startTime = inputTime(String(values.startTime));
        setModalError("");
        setEditor({ resource, id: values?.id, title: `${values ? "Chỉnh sửa" : "Thêm"} ${resource === "users" ? "tài khoản" : singular[resource]}`, values: next });
    };
    const saveEditor = async (event) => {
        event.preventDefault();
        if (!editor || saving)
            return;
        setSaving(true);
        setModalError("");
        try {
            const payload = { ...editor.values };
            delete payload.id;
            if (editor.resource === "movies") {
                delete payload.rating;
                delete payload.reviewCount;
                payload.genres = String(payload.genres).split(",").map(value => value.trim()).filter(Boolean);
                payload.cast = String(payload.cast).split(",").map(value => value.trim()).filter(Boolean);
            }
            if (editor.resource === "showtimes")
                payload.startTime = new Date(`${payload.startTime}:00+07:00`).toISOString();
            await request(`/api/admin/${editor.resource}${editor.id ? `/${editor.id}` : ""}`, { method: editor.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
            setEditor(null);
            setNotice("Đã lưu thay đổi thành công.");
            await refresh();
        }
        catch (caught) {
            setModalError(caught instanceof Error ? caught.message : "Không thể lưu dữ liệu.");
        }
        finally {
            setSaving(false);
        }
    };
    const remove = (resource, id, label) => {
        setModalError("");
        setConfirm({ title: `Xóa ${singular[resource]}?`, description: `Bạn sẽ xóa “${label}” khỏi danh mục. Thao tác không thể khôi phục. Dữ liệu đang gắn với suất chiếu hoặc đơn vé sẽ được hệ thống bảo vệ.`, button: "Xóa vĩnh viễn", run: async () => { await request(`/api/admin/${resource}/${id}`, { method: "DELETE" }); setNotice(`Đã xóa ${singular[resource]}.`); await refresh(); } });
    };
    const bookingAction = (booking, action) => {
        setModalError("");
        setConfirm({ title: action === "cancel" ? "Hủy đơn vé này?" : "Xác nhận soát vé?", description: action === "cancel" ? `Đơn ${booking.code} · ${booking.movieTitle} · ghế ${booking.seats.join(", ")} sẽ bị hủy và ghế được mở bán lại. ${booking.paymentProvider === "sepay" ? "Rạp cần xử lý hoàn tiền qua ngân hàng sau khi hủy." : "Kiểm tra phương thức thanh toán trước khi xử lý với khách."}` : `Xác nhận khách đã vào phòng ${booking.roomName}, ghế ${booking.seats.join(", ")}. Mã ${booking.code} sẽ không thể dùng để vào rạp lần nữa.`, button: action === "cancel" ? "Hủy đơn vé" : "Xác nhận vào rạp", run: async () => { await request(`/api/bookings/${booking.id}`, { method: "PATCH", body: JSON.stringify({ action }) }); setNotice(action === "cancel" ? "Đơn vé đã được hủy. Ghế đã mở bán lại." : "Soát vé thành công. Chúc khách xem phim vui vẻ!"); await load(); } });
    };
    const runConfirm = async () => {
        if (!confirm || saving)
            return;
        setSaving(true);
        setModalError("");
        try {
            await confirm.run();
            setConfirm(null);
        }
        catch (caught) {
            setModalError(caught instanceof Error ? caught.message : "Không thể thực hiện thao tác.");
        }
        finally {
            setSaving(false);
        }
    };
    const matches = (...values) => values.join(" ").toLocaleLowerCase("vi-VN").includes(search.trim().toLocaleLowerCase("vi-VN"));
    const filteredBookings = bookings.filter(booking => (filter === "all" || booking.status === filter) && matches(booking.code, booking.movieTitle, booking.customerName, booking.seats.join(" ")));
    const fields = {
        movies: [
            { key: "title", label: "Tên phim" }, { key: "originalTitle", label: "Tên gốc" },
            { key: "genres", label: "Thể loại", placeholder: "Hành động, Phiêu lưu", hint: "Ngăn cách các thể loại bằng dấu phẩy." },
            { key: "director", label: "Đạo diễn" }, { key: "duration", label: "Thời lượng (phút)", type: "number", min: 30, max: 300 },
            { key: "ageRating", label: "Phân loại độ tuổi", type: "select", options: ["P", "K", "T13", "T16", "T18", "C"].map(value => ({ value, label: value })) },
            { key: "status", label: "Trạng thái", type: "select", options: [{ value: "now", label: "Đang chiếu" }, { value: "coming", label: "Sắp chiếu" }] },
            { key: "releaseDate", label: "Ngày khởi chiếu", type: "date" }, { key: "cast", label: "Diễn viên", placeholder: "Tên 1, Tên 2", required: false },
            { key: "poster", label: "Ảnh poster", hint: "Đường dẫn / hoặc URL https://" }, { key: "backdrop", label: "Ảnh nền", hint: "Đường dẫn / hoặc URL https://" },
            { key: "description", label: "Nội dung phim", type: "textarea", full: true },
        ],
        showtimes: [
            { key: "movieId", label: "Phim đang chiếu", type: "select", options: data.movies.filter(movie => movie.status === "now").map(movie => ({ value: movie.id, label: movie.title })) },
            { key: "roomId", label: "Phòng chiếu", type: "select", options: data.rooms.map(room => ({ value: room.id, label: `${room.name} · ${room.type}` })) },
            { key: "startTime", label: "Ngày & giờ chiếu (Việt Nam)", type: "datetime-local", hint: "Các suất cách nhau ít nhất thời lượng phim + 15 phút." },
            { key: "price", label: "Giá vé (₫)", type: "number", min: 10000, max: 1000000 }, { key: "format", label: "Định dạng", placeholder: "2D · Phụ đề", full: true },
        ],
        rooms: [{ key: "name", label: "Tên phòng" }, { key: "type", label: "Loại phòng", placeholder: "Standard, IMAX, Dolby" }, { key: "rows", label: "Số hàng ghế", type: "number", min: 2, max: 20 }, { key: "cols", label: "Số ghế mỗi hàng", type: "number", min: 4, max: 30 }],
        combos: [{ key: "name", label: "Tên combo", full: true }, { key: "price", label: "Giá bán (₫)", type: "number", min: 0, max: 1000000 }, { key: "image", label: "Ảnh minh họa", hint: "Đường dẫn / hoặc URL https://" }, { key: "description", label: "Mô tả", type: "textarea", full: true }],
        promotions: [{ key: "code", label: "Mã ưu đãi", placeholder: "CINE10" }, { key: "discountPercent", label: "Giảm giá (%)", type: "number", min: 1, max: 100 }, { key: "minTotal", label: "Giá trị đơn tối thiểu (₫)", type: "number", min: 0, max: 10000000 }, { key: "active", label: "Bật mã ưu đãi", type: "checkbox" }],
        users: [{ key: "name", label: "Họ tên", full: true }, { key: "role", label: "Vai trò", type: "select", options: [{ value: "user", label: "Khách hàng" }, { value: "staff", label: "Nhân viên" }, { value: "admin", label: "Quản trị viên" }], full: true }],
    };
    const nav = isAdmin ? [
        { id: "payments", label: "Thanh toán SePay", icon: CircleDollarSign },
        { id:'email', label:'Thông báo email', icon:Users },
        { id: "overview", label: "Tổng quan", icon: LayoutDashboard }, { id: "movies", label: "Phim", icon: Film }, { id: "showtimes", label: "Lịch chiếu", icon: CalendarDays }, { id: "rooms", label: "Phòng chiếu", icon: Clapperboard }, { id: "bookings", label: "Đơn vé & soát vé", icon: Ticket }, { id: "pos", label: "Bán vé tại quầy", icon: CreditCard }, { id: "combos", label: "Bắp & nước", icon: Utensils }, { id: "promotions", label: "Ưu đãi", icon: CircleDollarSign }, { id: "rewards", label: "Quà thành viên", icon: Ticket }, { id: "users", label: "Tài khoản", icon: Users }, { id: "audit", label: "Nhật ký thay đổi", icon: ShieldCheck },
    ] : [{ id: "bookings", label: "Tra cứu & soát vé", icon: Ticket }, { id: "pos", label: "Bán vé tại quầy", icon: CreditCard }, { id: "rewards", label: "Quà thành viên", icon: Ticket }, { id: "members", label: "Khách hàng", icon: Users }];
    const actions = (resource, item, label) => <div className="mg-row-actions"><button className="mg-icon-button" aria-label={`Chỉnh sửa ${label}`} onClick={() => openEditor(resource, item)}><Pencil size={16}/></button><button className="mg-icon-button mg-delete" aria-label={`Xóa ${label}`} onClick={() => remove(resource, item.id, label)}><Trash2 size={16}/></button></div>;
    const bookingTable = (list, compact = false) => <div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Đơn vé / Khách hàng</th><th>Phim & suất chiếu</th><th>Ghế</th><th>Tổng tiền</th><th>Trạng thái</th><th>{compact ? "" : "Thao tác"}</th></tr></thead><tbody>{list.map(booking => {
            const delta = Date.parse(booking.startTime) - now;
            const checkable = delta <= 2 * 3600000 && delta >= -3 * 3600000;
            return <tr key={booking.id}><td><button className="mg-code-button" onClick={() => { setTicket(booking); setCopied(false); }}>{booking.code}</button><small>{booking.customerName || "Khách hàng"}</small></td><td><strong>{booking.movieTitle}</strong><small>{when(booking.startTime)} · {booking.roomName}</small></td><td><span className="mg-seat-text">{booking.seats.join(", ")}</span><small>{booking.seats.length} vé</small></td><td className="mg-nowrap">{money(booking.total)}</td><td><Status value={booking.status}/></td><td>{compact ? <button className="mg-icon-button" aria-label={`Xem đơn ${booking.code}`} onClick={() => setTicket(booking)}><ChevronRight size={18}/></button> : <div className="mg-booking-actions">{booking.status === "paid" && <><button className="mg-small-button" disabled={!checkable} title={checkable ? "Xác nhận khách vào rạp" : "Soát vé mở 2 giờ trước và đóng 3 giờ sau suất chiếu"} onClick={() => bookingAction(booking, "checkin")}><Check size={14}/>Soát vé</button><button className="mg-icon-button mg-delete" disabled={delta < 3600000} title="Hủy trước giờ chiếu ít nhất 60 phút" aria-label={`Hủy đơn ${booking.code}`} onClick={() => bookingAction(booking, "cancel")}><X size={16}/></button></>}</div>}</td></tr>;
        })}</tbody></table>{!list.length && <Empty title="Không tìm thấy đơn vé" detail="Thử tìm theo mã vé, tên khách hàng hoặc tên phim."/>}</div>;
    return <div className="mg-app">
    {sidebar && <button className="mg-sidebar-shade" aria-label="Đóng menu" onClick={() => setSidebar(false)}/>}
    <aside className={`mg-sidebar ${sidebar ? "mg-sidebar-open" : ""}`}><button className="mg-brand" onClick={onExit} aria-label="Về trang CineStar"><span className="mg-brand-icon"><Clapperboard size={23}/></span>Cine<span>Star</span><b>•</b></button><div className="mg-workspace-label">{isAdmin ? "KHÔNG GIAN QUẢN TRỊ" : "KHÔNG GIAN NHÂN VIÊN"}</div><nav className="mg-nav">{nav.map(item => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => navigate(item.id)}><item.icon size={19}/><span>{item.label}</span>{section === item.id && <span className="mg-nav-dot"/>}</button>)}</nav><div className="mg-sidebar-bottom"><div className="mg-demo-note"><ShieldCheck size={20}/><div><strong>{data.payment?.mode === "sepay" ? "Thanh toán thực tế" : "Môi trường học tập"}</strong><span>{data.payment?.mode === "sepay" ? "VietQR · SePay" : "Thanh toán được giả lập"}</span></div></div><button className="mg-exit" onClick={onExit}><ArrowLeft size={17}/>Về trang đặt vé<ArrowRight size={16}/></button><div className="mg-profile"><span className="mg-avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><span>{roleName(user.role)}</span></div><button className="mg-icon-button" aria-label="Đăng xuất" onClick={onLogout}><LogOut size={18}/></button></div></div></aside>
    <main className="mg-main"><header className="mg-topbar"><div className="mg-breadcrumb"><button className="mg-icon-button mg-mobile-menu" aria-label="Mở menu" onClick={() => setSidebar(true)}><Menu size={22}/></button><span>{isAdmin ? "Quản trị" : "Nhân viên"}</span><ChevronRight size={13}/><strong>{titles[section]}</strong></div><div className="mg-topbar-right"><span className="mg-live"><i />Hệ thống hoạt động</span><button className="mg-icon-button" disabled={loading} aria-label="Tải lại dữ liệu" onClick={() => void refresh()}><RefreshCw size={17} className={loading ? "mg-spin" : ""}/></button><span className="mg-top-avatar">{user.name.slice(0, 1).toUpperCase()}</span></div></header>
      <div className="mg-content"><div className="mg-page-heading"><div><p className="mg-eyebrow">CINESTAR / {isAdmin ? "ADMIN" : "STAFF"}</p><h1>{titles[section]}<span>.</span></h1><p>{section === "overview" ? `Chào ${user.name.split(" ").at(-1)}, đây là tình hình rạp của bạn.` : section === "bookings" ? "Tra cứu đơn hàng, xác nhận khách vào rạp và quản lý vé." : section === "pos" ? "Chọn phim, đặt ghế và phát hành vé cho khách tại quầy." : section === "members" ? "Tra cứu khách hàng và điều chỉnh ngày sinh với lý do rõ ràng." : section === "audit" ? "Theo dõi mọi thay đổi nghiệp vụ. Nhật ký không thể sửa hoặc xóa." : section === "rewards" ? "Tra cứu và xác nhận giao quà, combo đã đổi bằng điểm." : `Theo dõi và cập nhật ${section === "users" ? "tài khoản và quyền truy cập" : singular[section]} trong hệ thống.`}</p></div>{isAdmin && ["movies", "showtimes", "rooms", "combos", "promotions"].includes(section) && <button className="mg-primary" onClick={() => openEditor(section)}><Plus size={18}/>Thêm {singular[section]}</button>}{section === "overview" && <span className="mg-date-chip"><CalendarDays size={16}/>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(now))}</span>}</div>
      {error && <div className="mg-alert mg-alert-error" role="alert">{error}<button onClick={() => void load()}>Thử lại</button></div>}{notice && <div className="mg-alert mg-alert-success" role="status"><CheckCircle2 size={17}/>{notice}<button aria-label="Ẩn thông báo" onClick={() => setNotice("")}><X size={15}/></button></div>}
      {section === "overview" && isAdmin && <AdminAnalytics refreshToken={analyticsRevision}/> }
      {["bookings", "users", "movies", "showtimes", "rooms", "combos", "promotions"].includes(section) && <>
        <div className="mg-toolbar"><label className="mg-search"><Search size={18}/><input aria-label="Tìm kiếm" placeholder={section === "bookings" ? "Tìm mã vé, tên khách, phim…" : section === "users" ? "Tìm tên hoặc email…" : `Tìm ${singular[section]}…`} value={search} onChange={event => setSearch(event.target.value)}/>{search && <button aria-label="Xóa tìm kiếm" onClick={() => setSearch("")}><X size={15}/></button>}</label>{section === "bookings" && <select aria-label="Lọc trạng thái vé" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="pending">Chờ thanh toán</option><option value="expired">Hết hạn thanh toán</option><option value="paid">Đã thanh toán</option><option value="checked_in">Đã soát vé</option><option value="cancelled">Đã hủy</option></select>}{section === "movies" && <select aria-label="Lọc trạng thái phim" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả phim</option><option value="now">Đang chiếu</option><option value="coming">Sắp chiếu</option></select>}<span className="mg-result-count">{section === "bookings" ? `${filteredBookings.length} đơn vé` : section === "users" ? `${users.filter(item => matches(item.name, item.email)).length} tài khoản` : `${data[section].filter(item => matches(...Object.values(item))).length} mục`}</span></div>
        {section === "bookings" && <><div className="mg-booking-guidance"><Clock3 size={17}/><span>Soát vé: từ 2 giờ trước đến 3 giờ sau suất chiếu. Hủy vé: trước suất chiếu ít nhất 60 phút.</span></div><section className="mg-card">{loading && !bookings.length ? <div className="mg-loading"><RefreshCw className="mg-spin" size={20}/>Đang tải đơn vé…</div> : bookingTable(filteredBookings)}</section></>}
        {section === "movies" && isAdmin && <div className="mg-movie-grid">{data.movies.filter(movie => matches(movie.title, movie.originalTitle, movie.director) && (filter === "all" || movie.status === filter)).map(movie => <article className="mg-movie-card" key={movie.id}><div className="mg-movie-poster"><img src={movie.poster} alt={movie.title}/><span className={`mg-badge ${movie.status === "now" ? "mg-badge-green" : "mg-badge-blue"}`}>{movie.status === "now" ? "Đang chiếu" : "Sắp chiếu"}</span><span className="mg-age">{movie.ageRating}</span></div><div className="mg-movie-info"><h3>{movie.title}</h3><p>{movie.genres.join(" · ")}</p><div className="mg-movie-meta"><span><Clock3 size={13}/>{movie.duration} phút</span><span>★ {movieRatingLabel(movie)}</span></div><div className="mg-movie-bottom"><small>{day(`${movie.releaseDate}T12:00:00+07:00`)}/{movie.releaseDate.slice(0, 4)}</small>{actions("movies", movie, movie.title)}</div></div></article>)}{!data.movies.filter(movie => matches(movie.title, movie.originalTitle, movie.director) && (filter === "all" || movie.status === filter)).length && <Empty title="Không tìm thấy phim" detail="Thêm phim mới hoặc thử từ khóa khác." icon={<Film size={26}/>}/>}</div>}
        {section === "showtimes" && isAdmin && <section className="mg-card"><div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Phim</th><th>Phòng chiếu</th><th>Ngày & giờ</th><th>Định dạng</th><th>Giá vé</th><th>Thao tác</th></tr></thead><tbody>{[...data.showtimes].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)).filter(show => matches(data.movies.find(movie => movie.id === show.movieId)?.title, data.rooms.find(room => room.id === show.roomId)?.name, when(show.startTime))).map(show => { const movie = data.movies.find(movie => movie.id === show.movieId); const room = data.rooms.find(room => room.id === show.roomId); return <tr key={show.id}><td><div className="mg-film-cell">{movie && <img src={movie.poster} alt=""/>}<div><strong>{movie?.title || "Phim đã xóa"}</strong><small>{movie?.duration} phút · {movie?.ageRating}</small></div></div></td><td>{room?.name}<small>{room?.type}</small></td><td><strong>{time(show.startTime)}</strong><small>{day(show.startTime)}/{new Date(show.startTime).getFullYear()}{Date.parse(show.startTime) < now ? " · Đã kết thúc" : ""}</small></td><td><span className="mg-format-chip">{show.format}</span></td><td className="mg-nowrap">{money(show.price)}</td><td>{actions("showtimes", show, `${movie?.title} ${when(show.startTime)}`)}</td></tr>; })}</tbody></table>{!data.showtimes.length && <Empty title="Chưa có suất chiếu" detail="Thêm lịch chiếu để mở bán vé."/>}</div></section>}
        {section === "rooms" && isAdmin && <div className="mg-room-grid">{data.rooms.filter(room => matches(room.name, room.type)).map(room => <article className="mg-card mg-room-card" key={room.id}><div className="mg-room-top"><span className="mg-room-icon"><Clapperboard size={24}/></span>{actions("rooms", room, room.name)}</div><h3>{room.name}</h3><span className="mg-format-chip">{room.type}</span><div className="mg-room-preview" aria-hidden="true"><div className="mg-mini-screen"/>{Array.from({ length: Math.min(room.rows, 6) }, (_, row) => <div key={row}>{Array.from({ length: Math.min(room.cols, 12) }, (_, col) => <i key={col}/>)}</div>)}</div><div className="mg-room-bottom"><strong>{room.rows * room.cols}<span>ghế</span></strong><p>{room.rows} hàng × {room.cols} ghế / hàng</p></div></article>)}{!data.rooms.filter(room => matches(room.name, room.type)).length && <Empty title="Không tìm thấy phòng" detail="Thêm phòng mới hoặc thử từ khóa khác." icon={<Clapperboard size={26}/>}/>}</div>}
        {section === "combos" && isAdmin && <div className="mg-combo-grid">{data.combos.filter(combo => matches(combo.name, combo.description)).map(combo => <article className="mg-card mg-combo-card" key={combo.id}><div className="mg-combo-visual"><img src={combo.image} alt={combo.name} onError={event => { event.currentTarget.style.display = "none"; }}/><Utensils size={38}/></div><div><h3>{combo.name}</h3><p>{combo.description}</p><div className="mg-combo-bottom"><strong>{money(combo.price)}</strong>{actions("combos", combo, combo.name)}</div></div></article>)}{!data.combos.filter(combo => matches(combo.name, combo.description)).length && <Empty title="Không tìm thấy combo" detail="Thêm combo mới hoặc thử từ khóa khác." icon={<Utensils size={26}/>}/>}</div>}
        {section === "promotions" && isAdmin && <section className="mg-card"><div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Mã ưu đãi</th><th>Mức giảm</th><th>Đơn tối thiểu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.promotions.filter(promo => matches(promo.code)).map(promo => <tr key={promo.id}><td><span className="mg-promo-code">{promo.code}</span></td><td><strong className="mg-accent">{promo.discountPercent}%</strong></td><td>{money(promo.minTotal)}</td><td><span className={`mg-badge ${promo.active ? "mg-badge-green" : "mg-badge-muted"}`}><i />{promo.active ? "Đang hoạt động" : "Đã tắt"}</span></td><td>{actions("promotions", promo, promo.code)}</td></tr>)}</tbody></table>{!data.promotions.filter(promo => matches(promo.code)).length && <Empty title="Không tìm thấy ưu đãi" detail="Thêm mã mới để khách nhận ưu đãi." icon={<CircleDollarSign size={26}/>}/>}</div></section>}
        {section === "users" && isAdmin && <AccountsPanel users={users} currentUser={user} search={search} onChanged={refresh}/>}
      </>}
      {section === "rewards" && ["admin", "staff"].includes(user.role) && <RewardsPanel/>}
      {section === "members" && ["admin", "staff"].includes(user.role) && <StaffMembers Dialog={MemberDialog}/>}
      {section === "audit" && isAdmin && <AuditLog/>}
      {section === "payments" && isAdmin && <AdminPayments/>}
      {section === 'email' && isAdmin && <AdminEmail data={data}/>}
      {section === "pos" && <PointOfSale data={data} onComplete={async (booking) => { setTicket(booking); setNotice(`Đã phát hành vé. ${bookingPaymentLabel(booking)}.`); await load(); }}/>}
      </div>
    </main>
    {editor && <Modal title={editor.title} wide={editor.resource === "movies"} onClose={() => { if (!saving)
        setEditor(null); }}><form onSubmit={saveEditor}><div className="mg-form-fields">{fields[editor.resource].map(field => <label key={field.key} className={`mg-field ${field.full ? "mg-full" : ""} ${field.type === "checkbox" ? "mg-checkbox" : ""}`}><span>{field.label}{field.required !== false && field.type !== "checkbox" && <b> *</b>}</span>{field.type === "select" ? <select value={String(editor.values[field.key])} required={field.required !== false} onChange={event => setEditor({ ...editor, values: { ...editor.values, [field.key]: event.target.value } })}>{!editor.values[field.key] && <option value="">Chọn {field.label.toLowerCase()}</option>}{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === "textarea" ? <textarea rows={4} required={field.required !== false} value={String(editor.values[field.key])} onChange={event => setEditor({ ...editor, values: { ...editor.values, [field.key]: event.target.value } })}/> : field.type === "checkbox" ? <input type="checkbox" checked={Boolean(editor.values[field.key])} onChange={event => setEditor({ ...editor, values: { ...editor.values, [field.key]: event.target.checked } })}/> : <input type={field.type || "text"} required={field.required !== false} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder} value={String(editor.values[field.key])} onChange={event => setEditor({ ...editor, values: { ...editor.values, [field.key]: field.type === "number" ? event.target.value === "" ? "" : Number(event.target.value) : event.target.value } })}/>}{field.hint && <small>{field.hint}</small>}</label>)}</div>{editor.resource === "users" && <p className="mg-form-note">Quyền truy cập áp dụng ngay sau khi lưu. Hệ thống luôn giữ ít nhất một quản trị viên.</p>}{modalError && <div className="mg-alert mg-alert-error" role="alert">{modalError}</div>}<div className="mg-modal-actions"><button type="button" className="mg-secondary" disabled={saving} onClick={() => setEditor(null)}>Hủy</button><button type="submit" className="mg-primary" disabled={saving}>{saving ? <RefreshCw size={16} className="mg-spin"/> : <Check size={16}/>}{saving ? "Đang lưu…" : "Lưu thay đổi"}</button></div></form></Modal>}
    {confirm && <Modal title={confirm.title} onClose={() => { if (!saving)
        setConfirm(null); }}><p className="mg-confirm-description">{confirm.description}</p>{modalError && <div className="mg-alert mg-alert-error" role="alert">{modalError}</div>}<div className="mg-modal-actions"><button className="mg-secondary" disabled={saving} onClick={() => setConfirm(null)}>Quay lại</button><button className="mg-primary" disabled={saving} onClick={() => void runConfirm()}>{saving && <RefreshCw size={16} className="mg-spin"/>}{saving ? "Đang xử lý…" : confirm.button}</button></div></Modal>}
    {ticket && <Modal title="Chi tiết đơn vé" onClose={() => setTicket(null)}><div className="mg-ticket-detail"><div className="mg-ticket-icon"><Ticket size={34}/></div><Status value={ticket.status}/><h3>{ticket.movieTitle}</h3><p>{when(ticket.startTime)} · {ticket.roomName}</p><div className="mg-ticket-code"><span>MÃ VÉ</span><strong>{ticket.code}</strong><button className="mg-icon-button" aria-label="Sao chép mã vé" onClick={async () => { try {
        await navigator.clipboard.writeText(ticket.code);
        setCopied(true);
    }
    catch {
        setNotice("Không thể sao chép. Bạn có thể chọn mã vé và sao chép thủ công.");
    } }}>{copied ? <Check size={17}/> : <Copy size={17}/>}</button></div><dl><div><dt>Khách hàng</dt><dd>{ticket.customerName || user.name}</dd></div><div><dt>Ghế</dt><dd>{ticket.seats.join(", ")}</dd></div><div><dt>Combo</dt><dd>{ticket.combos.length ? ticket.combos.map(combo => `${data.combos.find(item => item.id === combo.id)?.name || "Combo"} × ${combo.qty}`).join(", ") : "Không có"}</dd></div><div><dt>Thanh toán</dt><dd>{bookingPaymentLabel(ticket)}{ticket.refundStatus === "pending" && " · Chờ hoàn tiền"}</dd></div><div><dt>Tổng tiền</dt><dd>{money(ticket.total)}</dd></div></dl><button className="mg-primary" onClick={() => setTicket(null)}>Hoàn tất<Check size={17}/></button></div></Modal>}
  </div>;
}
function PointOfSale({ data, onComplete }) {
    const movies = data.movies.filter(movie => movie.status === "now");
    const [movieId, setMovieId] = useState(movies[0]?.id || "");
    const [showtimeId, setShowtimeId] = useState("");
    const [combos, setCombos] = useState({});
    const [promo, setPromo] = useState("");
    const realPayment = data.payment?.mode === "sepay";
    const [payment, setPayment] = useState(realPayment ? "cash" : "bank");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const seatHold = useSeatHold(showtimeId, saving);
    const { seats, occupied, held, loading, error: seatLoadError } = seatHold;
    const [confirming, setConfirming] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const shows = data.showtimes.filter(show => show.movieId === movieId && Date.parse(show.startTime) > now + 600000).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
    const show = data.showtimes.find(item => item.id === showtimeId);
    const room = data.rooms.find(item => item.id === show?.roomId);
    const movie = data.movies.find(item => item.id === movieId);
    const subtotal = (show?.price || 0) * seats.length + Object.entries(combos).reduce((total, [id, qty]) => total + (data.combos.find(item => item.id === id)?.price || 0) * qty, 0);
    const promotion = data.promotions.find(item => item.code === promo.trim().toUpperCase() && item.active && subtotal >= item.minTotal);
    const total = promotion ? Math.round(subtotal * (100 - promotion.discountPercent) / 100) : subtotal;
    useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
    const submit = async () => {
        if (!show || !seatHold.valid || saving)
            return;
        setSaving(true);
        setError("");
        try {
            const result = await request("/api/bookings", { method: "POST", body: JSON.stringify({ showtimeId, holdToken: seatHold.holdToken, seats, combos: Object.entries(combos).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })), promotionCode: promo.trim() || undefined, paymentMethod: payment }) });
            setConfirming(false);
            seatHold.complete(result.booking.seats);
            setCombos({});
            setPromo("");
            await onComplete(result.booking);
        }
        catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không thể bán vé.");
            setConfirming(false);
            window.setTimeout(() => void seatHold.reload(), 0);
        }
        finally {
            setSaving(false);
        }
    };
    return <div className="mg-pos-layout"><div className="mg-pos-main"><section className="mg-card mg-pos-selection"><div className="mg-card-title"><h2><span className="mg-step">01</span>Chọn suất chiếu</h2></div><div className="mg-pos-selects"><label className="mg-field"><span>Phim</span><select value={movieId} disabled={saving || seatHold.pending} onChange={event => { setMovieId(event.target.value); setShowtimeId(""); setError(""); setConfirming(false); }}>{!movies.length && <option value="">Chưa có phim đang chiếu</option>}{movies.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label className="mg-field"><span>Suất chiếu</span><select value={showtimeId} disabled={saving || seatHold.pending} onChange={event => { setShowtimeId(event.target.value); setError(""); setConfirming(false); }}><option value="">{shows.length ? "Chọn suất chiếu" : "Chưa có suất mở bán"}</option>{shows.map(item => <option key={item.id} value={item.id}>{when(item.startTime)} · {data.rooms.find(room => room.id === item.roomId)?.name} · {money(item.price)}</option>)}</select></label></div></section>
    <section className="mg-card mg-pos-seats"><div className="mg-card-title"><h2><span className="mg-step">02</span>Chọn ghế</h2>{room && <span className="mg-period">{room.name} · {room.type}</span>}</div>{(error || seatLoadError) && <div className="mg-alert mg-alert-error" role="alert">{error || seatLoadError}<button disabled={saving || seatHold.pending} onClick={() => { setError(""); void seatHold.reload(); }}>Tải lại ghế</button></div>}{!show || !room ? <Empty title="Chọn suất chiếu để xem sơ đồ ghế" detail="Tối đa 8 ghế trong mỗi đơn vé." icon={<Clapperboard size={30}/>}/> : loading ? <div className="mg-loading"><RefreshCw size={21} className="mg-spin"/>Đang cập nhật sơ đồ ghế…</div> : <><div className="mg-pos-screen"><div />MÀN HÌNH</div><div className="mg-seat-map"><div style={{ minWidth: `${room.cols * 35 + 35}px` }}>{Array.from({ length: room.rows }, (_, row) => <div className="mg-seat-row" key={row}><span>{String.fromCharCode(65 + row)}</span>{Array.from({ length: room.cols }, (_, col) => { const id = `${String.fromCharCode(65 + row)}${col + 1}`; const taken = occupied.includes(id); const reserved = held.includes(id); const selected = seats.includes(id); return <button key={id} type="button" aria-label={`Ghế ${id}${taken ? ", đã đặt" : reserved ? ", người khác đang giữ" : selected ? ", bạn đang giữ" : ", còn trống"}`} aria-pressed={selected} disabled={taken || reserved || saving || seatHold.pending || !!seatLoadError || (!selected && seats.length >= 8)} className={`mg-seat ${taken ? "taken" : ""} ${reserved ? "held" : ""} ${selected ? "selected" : ""}`} onClick={() => { setError(""); void seatHold.toggleSeat(id); }}>{col + 1}</button>; })}</div>)}</div></div><div className="mg-seat-legend"><span><i />Còn trống</span><span><i className="selected"/>Bạn đang giữ</span><span><i className="held"/>Người khác giữ</span><span><i className="taken"/>Đã đặt</span></div><p className="mg-pos-hint">{seats.length >= 8 ? "Đã đạt giới hạn 8 ghế. Bỏ chọn một ghế để đổi vị trí." : "Ghế được giữ ngay khi chọn, tối đa 10 phút. Bỏ chọn để nhả ghế."}</p></>}</section>
    <section className="mg-card mg-pos-combos"><div className="mg-card-title"><h2><span className="mg-step">03</span>Thêm bắp & nước<span className="mg-optional">Tùy chọn</span></h2></div>{data.combos.map(combo => <div className="mg-pos-combo" key={combo.id}><div><strong>{combo.name}</strong><p>{combo.description}</p><span>{money(combo.price)}</span></div><div className="mg-quantity"><button aria-label={`Giảm ${combo.name}`} disabled={!combos[combo.id] || saving} onClick={() => setCombos({ ...combos, [combo.id]: Math.max(0, (combos[combo.id] || 0) - 1) })}><Minus size={14}/></button><b>{combos[combo.id] || 0}</b><button aria-label={`Thêm ${combo.name}`} disabled={(combos[combo.id] || 0) >= 5 || saving} onClick={() => setCombos({ ...combos, [combo.id]: (combos[combo.id] || 0) + 1 })}><Plus size={14}/></button></div></div>)}</section>
  </div><aside className="mg-card mg-pos-summary"><div className={`mg-hold-status ${seatHold.remainingSeconds > 0 && seatHold.remainingSeconds <= 60 ? "urgent" : ""}`} role="status">{seatHold.pending ? <><RefreshCw className="mg-spin" size={16}/>Đang cập nhật giữ ghế…</> : seats.length > 0 ? <><Clock3 size={16}/><div><strong>Giữ ghế còn {seatHold.countdown}</strong><small>Hoàn tất thanh toán trước khi hết giờ.</small></div></> : <><Clock3 size={16}/><span>Ghế được giữ ngay khi chọn, tối đa 10 phút.</span></>}</div><div className="mg-card-title"><h2>Thông tin đơn vé</h2><Ticket size={20}/></div>{movie && <div className="mg-pos-movie"><img src={movie.poster} alt=""/><div><h3>{movie.title}</h3><span>{movie.ageRating} · {movie.duration} phút</span><p>{show ? when(show.startTime) : "Chưa chọn suất chiếu"}</p>{show && <span>{show.format} · {room?.name}</span>}</div></div>}<div className="mg-pos-order"><div><span>Ghế đã chọn</span><strong>{seats.length ? seats.join(", ") : "—"}</strong></div><div><span>Tiền vé ({seats.length})</span><strong>{money((show?.price || 0) * seats.length)}</strong></div>{Object.entries(combos).filter(([, qty]) => qty > 0).map(([id, qty]) => <div key={id}><span>{data.combos.find(item => item.id === id)?.name} × {qty}</span><strong>{money((data.combos.find(item => item.id === id)?.price || 0) * qty)}</strong></div>)}</div><label className="mg-field mg-promo-field"><span>Mã ưu đãi</span><input placeholder="Nhập mã (nếu có)" value={promo} disabled={saving} onChange={event => setPromo(event.target.value.toUpperCase())}/>{promo && <small className={promotion ? "mg-accent" : ""}>{promotion ? `Đã áp dụng giảm ${promotion.discountPercent}%` : "Mã chưa hợp lệ hoặc đơn chưa đạt mức tối thiểu."}</small>}</label><label className="mg-field mg-payment-field"><span>{realPayment ? "Phương thức thu tiền" : "Phương thức thanh toán giả lập"}</span><select value={payment} disabled={saving} onChange={event => setPayment(event.target.value)}>{realPayment ? <option value="cash">Tiền mặt tại quầy</option> : <><option value="bank">Chuyển khoản</option><option value="momo">Ví MoMo</option><option value="card">Thẻ ngân hàng</option></>}</select></label>{promotion && <div className="mg-pos-discount"><span>Giảm giá</span><strong>−{money(subtotal - total)}</strong></div>}<div className="mg-pos-total"><span>Tổng thanh toán</span><strong>{money(total)}</strong></div><button className="mg-primary mg-pos-pay" disabled={!show || !seatHold.valid || saving || Boolean(error) || Boolean(promo && !promotion)} onClick={() => setConfirming(true)}><CreditCard size={18}/>{saving ? "Đang phát hành…" : "Thanh toán & phát hành vé"}</button><p className="mg-pos-payment-note"><ShieldCheck size={14}/>{realPayment ? "Chỉ xác nhận khi đã thu đủ tiền mặt." : "Giao dịch demo. Không thu tiền thật."}<br />Đơn vé tại quầy được lưu theo tài khoản nhân viên.</p></aside>
    {confirming && <Modal title={realPayment ? "Xác nhận đã thu tiền mặt" : "Xác nhận thanh toán giả lập"} onClose={() => { if (!saving)
        setConfirming(false); }}><p className="mg-confirm-description">{seatHold.valid ? `Thời gian giữ ghế còn ${seatHold.countdown}. ` : "Ghế chưa được giữ hoặc đã hết thời gian. Vui lòng quay lại chọn ghế. "}Phát hành {seats.length} vé cho <strong>{movie?.title}</strong>, ghế <strong>{seats.join(", ")}</strong> tại {room?.name} · {show ? when(show.startTime) : ""}. Đơn sẽ được ghi nhận đã thanh toán với tổng {money(total)}. {realPayment ? "Xác nhận bạn đã thu đủ tiền mặt trước khi phát hành vé." : "Không có tiền thật được giao dịch."}</p><div className="mg-modal-actions"><button className="mg-secondary" disabled={saving} onClick={() => setConfirming(false)}>Quay lại</button><button className="mg-primary" disabled={saving || !seatHold.valid} onClick={() => void submit()}>{saving ? <RefreshCw className="mg-spin" size={16}/> : <Check size={16}/>}{saving ? "Đang phát hành…" : "Xác nhận thanh toán"}</button></div></Modal>}
  </div>;
}
