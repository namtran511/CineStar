"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check, CheckCircle2, ChevronRight, CircleDollarSign, Clapperboard, Clock3, Copy, CreditCard, Film, LayoutDashboard, LogOut, Menu, Minus, Pencil, Plus, RefreshCw, Search, ShieldCheck, Ticket, Trash2, Users, Utensils, X } from "lucide-react";
import type { AdminSummary, Booking, Bootstrap, User } from "@/lib/types";
import "./management.css";

type Props = { user: User; data: Bootstrap; onExit: () => void; onLogout: () => void; onRefresh: () => Promise<void> };
type Resource = "movies" | "showtimes" | "rooms" | "combos" | "promotions";
type Section = "overview" | "bookings" | "pos" | "users" | Resource;
type Field = { key: string; label: string; type?: "number" | "date" | "datetime-local" | "textarea" | "select" | "checkbox"; options?: { value: string; label: string }[]; min?: number; max?: number; step?: string; placeholder?: string; hint?: string; full?: boolean; required?: boolean };
type FormValue = Record<string, string | number | boolean>;
type Editor = { resource: Resource | "users"; id?: string; title: string; values: FormValue };
type Confirm = { title: string; description: string; button: string; run: () => Promise<void> };
const titles: Record<Section, string> = { overview: "Tổng quan", movies: "Quản lý phim", showtimes: "Lịch chiếu", rooms: "Phòng chiếu", combos: "Bắp & nước", promotions: "Ưu đãi", users: "Tài khoản", bookings: "Đơn vé & soát vé", pos: "Bán vé tại quầy" };
const singular: Record<Resource, string> = { movies: "phim", showtimes: "suất chiếu", rooms: "phòng chiếu", combos: "combo", promotions: "ưu đãi" };
const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
const number = (value: number) => new Intl.NumberFormat("vi-VN").format(value);
const when = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const day = (value: string) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit" }).format(new Date(value));
const inputTime = (value: string) => new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16);
const roleName = (role: string) => ({ admin: "Quản trị viên", staff: "Nhân viên", user: "Khách hàng" }[role] || role);

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "Không thể hoàn tất thao tác. Vui lòng thử lại.");
  return body as T;
}

function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const oldFocus = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const list = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]');
      if (!list?.length) return;
      if (event.shiftKey && document.activeElement === list[0]) { event.preventDefault(); list[list.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === list[list.length - 1]) { event.preventDefault(); list[0].focus(); }
    };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", key); oldFocus?.focus(); };
  }, []);
  return <div className="mg-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div ref={ref} tabIndex={-1} className={`mg-modal ${wide ? "mg-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}><div className="mg-modal-head"><h2>{title}</h2><button className="mg-icon-button" aria-label="Đóng" onClick={onClose}><X size={20} /></button></div>{children}</div></div>;
}

function Empty({ title = "Chưa có dữ liệu", detail = "Dữ liệu mới sẽ xuất hiện tại đây.", icon = <Ticket size={26} /> }: { title?: string; detail?: string; icon?: ReactNode }) {
  return <div className="mg-empty"><div>{icon}</div><h3>{title}</h3><p>{detail}</p></div>;
}

function Status({ value }: { value: Booking["status"] }) { return <span className={`mg-badge mg-status-${value}`}><i />{({ paid: "Đã thanh toán", checked_in: "Đã soát vé", cancelled: "Đã hủy" })[value]}</span>; }

function RevenueChart({ values }: { values: AdminSummary["dailyRevenue"] }) {
  const max = Math.max(...values.map(value => value.revenue), 1);
  const width = 760; const height = 235; const left = 50; const right = 24; const top = 25; const bottom = 36;
  const points = values.map((value, i) => [left + i * (width - left - right) / Math.max(values.length - 1, 1), height - bottom - value.revenue / max * (height - top - bottom)]);
  const line = points.map(point => point.join(",")).join(" ");
  return <div className="mg-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ doanh thu theo ngày trong bảy ngày qua"><defs><linearGradient id="mg-revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff674d" stopOpacity=".27" /><stop offset="100%" stopColor="#ff674d" stopOpacity="0" /></linearGradient></defs>{[0, .25, .5, .75, 1].map(tick => { const y = height - bottom - tick * (height - top - bottom); return <g key={tick}><line x1={left} y1={y} x2={width - right} y2={y} stroke="#2a2c34" strokeDasharray="4 5" /><text x={left - 10} y={y + 4} textAnchor="end" fill="#7b7e8b" fontSize="10">{max <= 1 ? "0" : Math.round(max * tick / 1000).toLocaleString("vi-VN") + "k"}</text></g>; })}{points.length > 0 && <><polygon points={`${left},${height - bottom} ${line} ${width - right},${height - bottom}`} fill="url(#mg-revenue-fill)" /><polyline points={line} fill="none" stroke="#ff674d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" /></>}{values.map((value, i) => <g key={value.date}><circle cx={points[i][0]} cy={points[i][1]} r="4" fill="#ff674d" stroke="#14161d" strokeWidth="2"><title>{day(`${value.date}T12:00:00+07:00`)}: {money(value.revenue)}</title></circle><text x={points[i][0]} y={height - 10} textAnchor="middle" fill="#8d909c" fontSize="11">{day(`${value.date}T12:00:00+07:00`)}</text></g>)}</svg></div>;
}

export default function ManagementApp({ user, data, onExit, onLogout, onRefresh }: Props) {
  const isAdmin = user.role === "admin";
  const [section, setSection] = useState<Section>(isAdmin ? "overview" : "bookings");
  const [sidebar, setSidebar] = useState(false);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState("");
  const [ticket, setTicket] = useState<Booking | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await request<{ bookings: Booking[] }>("/api/bookings"); setBookings(result.bookings);
      if (isAdmin) {
        const results = await Promise.allSettled([request<AdminSummary>("/api/admin/summary"), request<{ users: User[] }>("/api/admin/users")]);
        if (results[0].status === "fulfilled") setSummary(results[0].value); else throw results[0].reason;
        if (results[1].status === "fulfilled") setUsers(results[1].value.users); else throw results[1].reason;
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải dữ liệu."); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load(); }); return () => { active = false; }; }, [load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 6000); return () => window.clearTimeout(timer); }, [notice]);
  const refresh = async () => { await onRefresh(); await load(); };
  const navigate = (next: Section) => { setSection(next); setSearch(""); setFilter("all"); setSidebar(false); };
  const openEditor = (resource: Editor["resource"], values?: Record<string, unknown>) => {
    const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
    const defaults: Record<Editor["resource"], FormValue> = {
      movies: { title: "", originalTitle: "", genres: "", duration: 120, rating: 7, ageRating: "T13", poster: "/images/dune.jpg", backdrop: "/images/hero.jpg", description: "", director: "", cast: "", releaseDate: date, status: "now" },
      showtimes: { movieId: data.movies.find(movie => movie.status === "now")?.id || "", roomId: data.rooms[0]?.id || "", startTime: "", price: 90000, format: "2D · Phụ đề" },
      rooms: { name: "", rows: 8, cols: 12, type: "Standard" },
      combos: { name: "", description: "", price: 79000, image: "/images/combo-solo.svg" },
      promotions: { code: "", discountPercent: 10, minTotal: 100000, active: true },
      users: { name: "", role: "user" },
    };
    const next = { ...defaults[resource], ...(values || {}) } as FormValue;
    if (resource === "movies" && values) { next.genres = (values.genres as string[]).join(", "); next.cast = (values.cast as string[]).join(", "); }
    if (resource === "showtimes" && values) next.startTime = inputTime(String(values.startTime));
    setModalError(""); setEditor({ resource, id: values?.id as string | undefined, title: `${values ? "Chỉnh sửa" : "Thêm"} ${resource === "users" ? "tài khoản" : singular[resource]}`, values: next });
  };
  const saveEditor = async (event: FormEvent) => {
    event.preventDefault(); if (!editor || saving) return;
    setSaving(true); setModalError("");
    try {
      const payload: Record<string, unknown> = { ...editor.values }; delete payload.id;
      if (editor.resource === "movies") { payload.genres = String(payload.genres).split(",").map(value => value.trim()).filter(Boolean); payload.cast = String(payload.cast).split(",").map(value => value.trim()).filter(Boolean); }
      if (editor.resource === "showtimes") payload.startTime = new Date(`${payload.startTime}:00+07:00`).toISOString();
      await request(`/api/admin/${editor.resource}${editor.id ? `/${editor.id}` : ""}`, { method: editor.id ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setEditor(null); setNotice("Đã lưu thay đổi thành công."); await refresh();
    } catch (caught) { setModalError(caught instanceof Error ? caught.message : "Không thể lưu dữ liệu."); }
    finally { setSaving(false); }
  };
  const remove = (resource: Resource, id: string, label: string) => {
    setModalError("");
    setConfirm({ title: `Xóa ${singular[resource]}?`, description: `Bạn sẽ xóa “${label}” khỏi danh mục. Thao tác không thể khôi phục. Dữ liệu đang gắn với suất chiếu hoặc đơn vé sẽ được hệ thống bảo vệ.`, button: "Xóa vĩnh viễn", run: async () => { await request(`/api/admin/${resource}/${id}`, { method: "DELETE" }); setNotice(`Đã xóa ${singular[resource]}.`); await refresh(); } });
  };
  const bookingAction = (booking: Booking, action: "cancel" | "checkin") => {
    setModalError("");
    setConfirm({ title: action === "cancel" ? "Hủy đơn vé này?" : "Xác nhận soát vé?", description: action === "cancel" ? `Đơn ${booking.code} · ${booking.movieTitle} · ghế ${booking.seats.join(", ")} sẽ bị hủy và ghế được mở bán lại. Thanh toán là giả lập nên không có giao dịch hoàn tiền thực.` : `Xác nhận khách đã vào phòng ${booking.roomName}, ghế ${booking.seats.join(", ")}. Mã ${booking.code} sẽ không thể dùng để vào rạp lần nữa.`, button: action === "cancel" ? "Hủy đơn vé" : "Xác nhận vào rạp", run: async () => { await request(`/api/bookings/${booking.id}`, { method: "PATCH", body: JSON.stringify({ action }) }); setNotice(action === "cancel" ? "Đơn vé đã được hủy. Ghế đã mở bán lại." : "Soát vé thành công. Chúc khách xem phim vui vẻ!"); await load(); } });
  };
  const runConfirm = async () => {
    if (!confirm || saving) return; setSaving(true); setModalError("");
    try { await confirm.run(); setConfirm(null); } catch (caught) { setModalError(caught instanceof Error ? caught.message : "Không thể thực hiện thao tác."); } finally { setSaving(false); }
  };
  const matches = (...values: unknown[]) => values.join(" ").toLocaleLowerCase("vi-VN").includes(search.trim().toLocaleLowerCase("vi-VN"));
  const filteredBookings = bookings.filter(booking => (filter === "all" || booking.status === filter) && matches(booking.code, booking.movieTitle, booking.customerName, booking.seats.join(" ")));
  const fields: Record<Editor["resource"], Field[]> = {
    movies: [
      { key: "title", label: "Tên phim" }, { key: "originalTitle", label: "Tên gốc" },
      { key: "genres", label: "Thể loại", placeholder: "Hành động, Phiêu lưu", hint: "Ngăn cách các thể loại bằng dấu phẩy." },
      { key: "director", label: "Đạo diễn" }, { key: "duration", label: "Thời lượng (phút)", type: "number", min: 30, max: 300 },
      { key: "rating", label: "Điểm đánh giá (0–10)", type: "number", min: 0, max: 10, step: "0.1" },
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
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard }, { id: "movies", label: "Phim", icon: Film }, { id: "showtimes", label: "Lịch chiếu", icon: CalendarDays }, { id: "rooms", label: "Phòng chiếu", icon: Clapperboard }, { id: "bookings", label: "Đơn vé & soát vé", icon: Ticket }, { id: "pos", label: "Bán vé tại quầy", icon: CreditCard }, { id: "combos", label: "Bắp & nước", icon: Utensils }, { id: "promotions", label: "Ưu đãi", icon: CircleDollarSign }, { id: "users", label: "Tài khoản", icon: Users },
  ] : [{ id: "bookings", label: "Tra cứu & soát vé", icon: Ticket }, { id: "pos", label: "Bán vé tại quầy", icon: CreditCard }];

  const actions = (resource: Resource, item: { id: string }, label: string) => <div className="mg-row-actions"><button className="mg-icon-button" aria-label={`Chỉnh sửa ${label}`} onClick={() => openEditor(resource, item as unknown as Record<string, unknown>)}><Pencil size={16} /></button><button className="mg-icon-button mg-delete" aria-label={`Xóa ${label}`} onClick={() => remove(resource, item.id, label)}><Trash2 size={16} /></button></div>;
  const bookingTable = (list: Booking[], compact = false) => <div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Đơn vé / Khách hàng</th><th>Phim & suất chiếu</th><th>Ghế</th><th>Tổng tiền</th><th>Trạng thái</th><th>{compact ? "" : "Thao tác"}</th></tr></thead><tbody>{list.map(booking => {
    const delta = Date.parse(booking.startTime) - now; const checkable = delta <= 2 * 3600000 && delta >= -3 * 3600000;
    return <tr key={booking.id}><td><button className="mg-code-button" onClick={() => { setTicket(booking); setCopied(false); }}>{booking.code}</button><small>{booking.customerName || "Khách hàng"}</small></td><td><strong>{booking.movieTitle}</strong><small>{when(booking.startTime)} · {booking.roomName}</small></td><td><span className="mg-seat-text">{booking.seats.join(", ")}</span><small>{booking.seats.length} vé</small></td><td className="mg-nowrap">{money(booking.total)}</td><td><Status value={booking.status} /></td><td>{compact ? <button className="mg-icon-button" aria-label={`Xem đơn ${booking.code}`} onClick={() => setTicket(booking)}><ChevronRight size={18} /></button> : <div className="mg-booking-actions">{booking.status === "paid" && <><button className="mg-small-button" disabled={!checkable} title={checkable ? "Xác nhận khách vào rạp" : "Soát vé mở 2 giờ trước và đóng 3 giờ sau suất chiếu"} onClick={() => bookingAction(booking, "checkin")}><Check size={14} />Soát vé</button><button className="mg-icon-button mg-delete" disabled={delta < 3600000} title="Hủy trước giờ chiếu ít nhất 60 phút" aria-label={`Hủy đơn ${booking.code}`} onClick={() => bookingAction(booking, "cancel")}><X size={16} /></button></>}</div>}</td></tr>;
  })}</tbody></table>{!list.length && <Empty title="Không tìm thấy đơn vé" detail="Thử tìm theo mã vé, tên khách hàng hoặc tên phim." />}</div>;

  return <div className="mg-app">
    {sidebar && <button className="mg-sidebar-shade" aria-label="Đóng menu" onClick={() => setSidebar(false)} />}
    <aside className={`mg-sidebar ${sidebar ? "mg-sidebar-open" : ""}`}><button className="mg-brand" onClick={onExit} aria-label="Về trang CineVerse"><span className="mg-brand-icon"><Clapperboard size={23} /></span>Cine<span>Verse</span><b>•</b></button><div className="mg-workspace-label">{isAdmin ? "KHÔNG GIAN QUẢN TRỊ" : "KHÔNG GIAN NHÂN VIÊN"}</div><nav className="mg-nav">{nav.map(item => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => navigate(item.id as Section)}><item.icon size={19} /><span>{item.label}</span>{section === item.id && <span className="mg-nav-dot" />}</button>)}</nav><div className="mg-sidebar-bottom"><div className="mg-demo-note"><ShieldCheck size={20} /><div><strong>Môi trường học tập</strong><span>Thanh toán được giả lập</span></div></div><button className="mg-exit" onClick={onExit}><ArrowLeft size={17} />Về trang đặt vé<ArrowRight size={16} /></button><div className="mg-profile"><span className="mg-avatar">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}</strong><span>{roleName(user.role)}</span></div><button className="mg-icon-button" aria-label="Đăng xuất" onClick={onLogout}><LogOut size={18} /></button></div></div></aside>
    <main className="mg-main"><header className="mg-topbar"><div className="mg-breadcrumb"><button className="mg-icon-button mg-mobile-menu" aria-label="Mở menu" onClick={() => setSidebar(true)}><Menu size={22} /></button><span>{isAdmin ? "Quản trị" : "Nhân viên"}</span><ChevronRight size={13} /><strong>{titles[section]}</strong></div><div className="mg-topbar-right"><span className="mg-live"><i />Hệ thống hoạt động</span><button className="mg-icon-button" disabled={loading} aria-label="Tải lại dữ liệu" onClick={() => void refresh()}><RefreshCw size={17} className={loading ? "mg-spin" : ""} /></button><span className="mg-top-avatar">{user.name.slice(0, 1).toUpperCase()}</span></div></header>
      <div className="mg-content"><div className="mg-page-heading"><div><p className="mg-eyebrow">CINEVERSE / {isAdmin ? "ADMIN" : "STAFF"}</p><h1>{titles[section]}<span>.</span></h1><p>{section === "overview" ? `Chào ${user.name.split(" ").at(-1)}, đây là tình hình rạp của bạn.` : section === "bookings" ? "Tra cứu đơn hàng, xác nhận khách vào rạp và quản lý vé." : section === "pos" ? "Chọn phim, đặt ghế và phát hành vé cho khách tại quầy." : `Theo dõi và cập nhật ${section === "users" ? "tài khoản và quyền truy cập" : singular[section as Resource]} trong hệ thống.`}</p></div>{isAdmin && ["movies", "showtimes", "rooms", "combos", "promotions"].includes(section) && <button className="mg-primary" onClick={() => openEditor(section as Resource)}><Plus size={18} />Thêm {singular[section as Resource]}</button>}{section === "overview" && <span className="mg-date-chip"><CalendarDays size={16} />{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(now))}</span>}</div>
      {error && <div className="mg-alert mg-alert-error" role="alert">{error}<button onClick={() => void load()}>Thử lại</button></div>}{notice && <div className="mg-alert mg-alert-success" role="status"><CheckCircle2 size={17} />{notice}<button aria-label="Ẩn thông báo" onClick={() => setNotice("")}><X size={15} /></button></div>}
      {section === "overview" && isAdmin && <>
        <div className="mg-stats">{[{ title: "Tổng doanh thu", value: summary ? money(summary.revenue) : "—", note: "Đơn thanh toán & đã soát vé", icon: CircleDollarSign, color: "coral" }, { title: "Vé đã bán", value: summary ? number(summary.tickets) : "—", note: `${summary?.orders ?? 0} đơn hàng thành công`, icon: Ticket, color: "blue" }, { title: "Tỷ lệ lấp đầy", value: summary ? `${summary.occupancy}%` : "—", note: "Các suất trong 7 ngày tới", icon: BarChart3, color: "purple" }, { title: "Phim đang chiếu", value: number(data.movies.filter(movie => movie.status === "now").length), note: `${data.rooms.length} phòng · ${data.showtimes.filter(show => Date.parse(show.startTime) > now).length} suất sắp tới`, icon: Film, color: "green" }].map(stat => <div className="mg-stat" key={stat.title}><div className="mg-stat-top"><span>{stat.title}</span><div className={`mg-stat-icon ${stat.color}`}><stat.icon size={19} /></div></div><strong>{stat.value}</strong><p>{stat.note}</p></div>)}</div>
        <div className="mg-dashboard-grid"><section className="mg-card mg-revenue-card"><div className="mg-card-title"><div><h2>Doanh thu</h2><p>Đơn hàng thành công trong 7 ngày gần nhất</p></div><span className="mg-period">7 ngày qua</span></div>{summary ? <><RevenueChart values={summary.dailyRevenue} /><div className="mg-chart-legend"><i />Doanh thu <span>Không bao gồm đơn đã hủy</span></div></> : <div className="mg-loading"><RefreshCw className="mg-spin" size={21} />Đang tải doanh thu…</div>}</section><section className="mg-card"><div className="mg-card-title"><div><h2>Phim nổi bật</h2><p>Xếp theo doanh thu thực tế</p></div><Film size={19} /></div>{summary?.byMovie.length ? <div className="mg-top-movies">{summary.byMovie.slice(0, 4).map((movie, index) => { const item = data.movies.find(item => item.title === movie.title); return <div className="mg-top-movie" key={movie.title}><span className="mg-rank">{String(index + 1).padStart(2, "0")}</span>{item && <img src={item.poster} alt="" />}<div><strong>{movie.title}</strong><span>{movie.tickets} vé đã bán</span></div><b>{money(movie.revenue)}</b></div>; })}</div> : <Empty title="Chưa có doanh thu" detail="Phim được xếp hạng khi có đơn vé thành công." icon={<Film size={24} />} />}</section></div>
        <section className="mg-card mg-bookings-card"><div className="mg-card-title"><div><h2>Đơn vé gần đây</h2><p>Các giao dịch mới nhất của rạp</p></div><button className="mg-text-button" onClick={() => navigate("bookings")}>Xem tất cả<ArrowRight size={16} /></button></div>{bookingTable(summary?.recentBookings || [], true)}</section>
        <div className="mg-overview-footer"><ShieldCheck size={14} />Số liệu được tính từ cơ sở dữ liệu · Thanh toán giả lập cho bài tập lớn</div>
      </>}
      {section !== "overview" && section !== "pos" && <>
        <div className="mg-toolbar"><label className="mg-search"><Search size={18} /><input aria-label="Tìm kiếm" placeholder={section === "bookings" ? "Tìm mã vé, tên khách, phim…" : section === "users" ? "Tìm tên hoặc email…" : `Tìm ${singular[section as Resource]}…`} value={search} onChange={event => setSearch(event.target.value)} />{search && <button aria-label="Xóa tìm kiếm" onClick={() => setSearch("")}><X size={15} /></button>}</label>{section === "bookings" && <select aria-label="Lọc trạng thái vé" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả trạng thái</option><option value="paid">Đã thanh toán</option><option value="checked_in">Đã soát vé</option><option value="cancelled">Đã hủy</option></select>}{section === "movies" && <select aria-label="Lọc trạng thái phim" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Tất cả phim</option><option value="now">Đang chiếu</option><option value="coming">Sắp chiếu</option></select>}<span className="mg-result-count">{section === "bookings" ? `${filteredBookings.length} đơn vé` : section === "users" ? `${users.filter(item => matches(item.name, item.email)).length} tài khoản` : `${data[section as Resource].filter(item => matches(...Object.values(item))).length} mục`}</span></div>
        {section === "bookings" && <><div className="mg-booking-guidance"><Clock3 size={17} /><span>Soát vé: từ 2 giờ trước đến 3 giờ sau suất chiếu. Hủy vé: trước suất chiếu ít nhất 60 phút.</span></div><section className="mg-card">{loading && !bookings.length ? <div className="mg-loading"><RefreshCw className="mg-spin" size={20} />Đang tải đơn vé…</div> : bookingTable(filteredBookings)}</section></>}
        {section === "movies" && isAdmin && <div className="mg-movie-grid">{data.movies.filter(movie => matches(movie.title, movie.originalTitle, movie.director) && (filter === "all" || movie.status === filter)).map(movie => <article className="mg-movie-card" key={movie.id}><div className="mg-movie-poster"><img src={movie.poster} alt={movie.title} /><span className={`mg-badge ${movie.status === "now" ? "mg-badge-green" : "mg-badge-blue"}`}>{movie.status === "now" ? "Đang chiếu" : "Sắp chiếu"}</span><span className="mg-age">{movie.ageRating}</span></div><div className="mg-movie-info"><h3>{movie.title}</h3><p>{movie.genres.join(" · ")}</p><div className="mg-movie-meta"><span><Clock3 size={13} />{movie.duration} phút</span><span>★ {movie.rating.toFixed(1)}</span></div><div className="mg-movie-bottom"><small>{day(`${movie.releaseDate}T12:00:00+07:00`)}/{movie.releaseDate.slice(0, 4)}</small>{actions("movies", movie, movie.title)}</div></div></article>)}{!data.movies.filter(movie => matches(movie.title, movie.originalTitle, movie.director) && (filter === "all" || movie.status === filter)).length && <Empty title="Không tìm thấy phim" detail="Thêm phim mới hoặc thử từ khóa khác." icon={<Film size={26} />} />}</div>}
        {section === "showtimes" && isAdmin && <section className="mg-card"><div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Phim</th><th>Phòng chiếu</th><th>Ngày & giờ</th><th>Định dạng</th><th>Giá vé</th><th>Thao tác</th></tr></thead><tbody>{[...data.showtimes].sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime)).filter(show => matches(data.movies.find(movie => movie.id === show.movieId)?.title, data.rooms.find(room => room.id === show.roomId)?.name, when(show.startTime))).map(show => { const movie = data.movies.find(movie => movie.id === show.movieId); const room = data.rooms.find(room => room.id === show.roomId); return <tr key={show.id}><td><div className="mg-film-cell">{movie && <img src={movie.poster} alt="" />}<div><strong>{movie?.title || "Phim đã xóa"}</strong><small>{movie?.duration} phút · {movie?.ageRating}</small></div></div></td><td>{room?.name}<small>{room?.type}</small></td><td><strong>{time(show.startTime)}</strong><small>{day(show.startTime)}/{new Date(show.startTime).getFullYear()}{Date.parse(show.startTime) < now ? " · Đã kết thúc" : ""}</small></td><td><span className="mg-format-chip">{show.format}</span></td><td className="mg-nowrap">{money(show.price)}</td><td>{actions("showtimes", show, `${movie?.title} ${when(show.startTime)}`)}</td></tr>; })}</tbody></table>{!data.showtimes.length && <Empty title="Chưa có suất chiếu" detail="Thêm lịch chiếu để mở bán vé." />}</div></section>}
        {section === "rooms" && isAdmin && <div className="mg-room-grid">{data.rooms.filter(room => matches(room.name, room.type)).map(room => <article className="mg-card mg-room-card" key={room.id}><div className="mg-room-top"><span className="mg-room-icon"><Clapperboard size={24} /></span>{actions("rooms", room, room.name)}</div><h3>{room.name}</h3><span className="mg-format-chip">{room.type}</span><div className="mg-room-preview" aria-hidden="true"><div className="mg-mini-screen" />{Array.from({ length: Math.min(room.rows, 6) }, (_, row) => <div key={row}>{Array.from({ length: Math.min(room.cols, 12) }, (_, col) => <i key={col} />)}</div>)}</div><div className="mg-room-bottom"><strong>{room.rows * room.cols}<span>ghế</span></strong><p>{room.rows} hàng × {room.cols} ghế / hàng</p></div></article>)}{!data.rooms.filter(room => matches(room.name, room.type)).length && <Empty title="Không tìm thấy phòng" detail="Thêm phòng mới hoặc thử từ khóa khác." icon={<Clapperboard size={26} />} />}</div>}
        {section === "combos" && isAdmin && <div className="mg-combo-grid">{data.combos.filter(combo => matches(combo.name, combo.description)).map(combo => <article className="mg-card mg-combo-card" key={combo.id}><div className="mg-combo-visual"><img src={combo.image} alt={combo.name} onError={event => { event.currentTarget.style.display = "none"; }} /><Utensils size={38} /></div><div><h3>{combo.name}</h3><p>{combo.description}</p><div className="mg-combo-bottom"><strong>{money(combo.price)}</strong>{actions("combos", combo, combo.name)}</div></div></article>)}{!data.combos.filter(combo => matches(combo.name, combo.description)).length && <Empty title="Không tìm thấy combo" detail="Thêm combo mới hoặc thử từ khóa khác." icon={<Utensils size={26} />} />}</div>}
        {section === "promotions" && isAdmin && <section className="mg-card"><div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Mã ưu đãi</th><th>Mức giảm</th><th>Đơn tối thiểu</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.promotions.filter(promo => matches(promo.code)).map(promo => <tr key={promo.id}><td><span className="mg-promo-code">{promo.code}</span></td><td><strong className="mg-accent">{promo.discountPercent}%</strong></td><td>{money(promo.minTotal)}</td><td><span className={`mg-badge ${promo.active ? "mg-badge-green" : "mg-badge-muted"}`}><i />{promo.active ? "Đang hoạt động" : "Đã tắt"}</span></td><td>{actions("promotions", promo, promo.code)}</td></tr>)}</tbody></table>{!data.promotions.filter(promo => matches(promo.code)).length && <Empty title="Không tìm thấy ưu đãi" detail="Thêm mã mới để khách nhận ưu đãi." icon={<CircleDollarSign size={26} />} />}</div></section>}
        {section === "users" && isAdmin && <><div className="mg-booking-guidance"><ShieldCheck size={17} /><span>Quản trị viên quản lý dữ liệu. Nhân viên bán vé và soát vé. Khách hàng đặt vé và dùng trợ lý AI.</span></div><section className="mg-card"><div className="mg-table-wrap"><table className="mg-table"><thead><tr><th>Tài khoản</th><th>Email</th><th>Vai trò</th><th>Thao tác</th></tr></thead><tbody>{users.filter(item => matches(item.name, item.email)).map(item => <tr key={item.id}><td><div className="mg-user-cell"><span className="mg-avatar">{item.name.slice(0, 1).toUpperCase()}</span><strong>{item.name}{item.id === user.id && <small>Bạn</small>}</strong></div></td><td>{item.email}</td><td><span className={`mg-badge ${item.role === "admin" ? "mg-badge-coral" : item.role === "staff" ? "mg-badge-blue" : "mg-badge-muted"}`}>{roleName(item.role)}</span></td><td><button className="mg-small-button" onClick={() => openEditor("users", item as unknown as Record<string, unknown>)}><Pencil size={14} />Chỉnh sửa</button></td></tr>)}</tbody></table>{!users.filter(item => matches(item.name, item.email)).length && <Empty title="Không tìm thấy tài khoản" detail="Thử tìm bằng tên hoặc email khác." icon={<Users size={26} />} />}</div></section></>}
      </>}
      {section === "pos" && <PointOfSale data={data} onComplete={async booking => { setTicket(booking); setNotice("Đã phát hành vé. Thanh toán đã được giả lập thành công."); await load(); }} />}
      </div>
    </main>
    {editor && <Modal title={editor.title} wide={editor.resource === "movies"} onClose={() => { if (!saving) setEditor(null); }}><form onSubmit={saveEditor}><div className="mg-form-fields">{fields[editor.resource].map(field => <label key={field.key} className={`mg-field ${field.full ? "mg-full" : ""} ${field.type === "checkbox" ? "mg-checkbox" : ""}`}><span>{field.label}{field.required !== false && field.type !== "checkbox" && <b> *</b>}</span>{field.type === "select" ? <select value={String(editor.values[field.key])} required={field.required !== false} onChange={event => setEditor({ ...editor, values: { ...editor.values, [field.key]: event.target.value } })}>{!editor.values[field.key] && <option value="">Chọn {field.label.toLowerCase()}</option>}{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === "textarea" ? <textarea rows={4} required={field.required !== false} value={String(editor.values[field.key])} onChange={event => setEditor({ ...editor, values: { ...editor.values, [field.key]: event.target.value } })} /> : field.type === "checkbox" ? <input type="checkbox" checked={Boolean(editor.values[field.key])} onChange={event => setEditor({ ...editor, values: { ...editor.values, [field.key]: event.target.checked } })} /> : <input type={field.type || "text"} required={field.required !== false} min={field.min} max={field.max} step={field.step} placeholder={field.placeholder} value={String(editor.values[field.key])} onChange={event => setEditor({ ...editor, values: { ...editor.values, [field.key]: field.type === "number" ? event.target.value === "" ? "" : Number(event.target.value) : event.target.value } })} />}{field.hint && <small>{field.hint}</small>}</label>)}</div>{editor.resource === "users" && <p className="mg-form-note">Quyền truy cập áp dụng ngay sau khi lưu. Hệ thống luôn giữ ít nhất một quản trị viên.</p>}{modalError && <div className="mg-alert mg-alert-error" role="alert">{modalError}</div>}<div className="mg-modal-actions"><button type="button" className="mg-secondary" disabled={saving} onClick={() => setEditor(null)}>Hủy</button><button type="submit" className="mg-primary" disabled={saving}>{saving ? <RefreshCw size={16} className="mg-spin" /> : <Check size={16} />}{saving ? "Đang lưu…" : "Lưu thay đổi"}</button></div></form></Modal>}
    {confirm && <Modal title={confirm.title} onClose={() => { if (!saving) setConfirm(null); }}><p className="mg-confirm-description">{confirm.description}</p>{modalError && <div className="mg-alert mg-alert-error" role="alert">{modalError}</div>}<div className="mg-modal-actions"><button className="mg-secondary" disabled={saving} onClick={() => setConfirm(null)}>Quay lại</button><button className="mg-primary" disabled={saving} onClick={() => void runConfirm()}>{saving && <RefreshCw size={16} className="mg-spin" />}{saving ? "Đang xử lý…" : confirm.button}</button></div></Modal>}
    {ticket && <Modal title="Chi tiết đơn vé" onClose={() => setTicket(null)}><div className="mg-ticket-detail"><div className="mg-ticket-icon"><Ticket size={34} /></div><Status value={ticket.status} /><h3>{ticket.movieTitle}</h3><p>{when(ticket.startTime)} · {ticket.roomName}</p><div className="mg-ticket-code"><span>MÃ VÉ</span><strong>{ticket.code}</strong><button className="mg-icon-button" aria-label="Sao chép mã vé" onClick={async () => { try { await navigator.clipboard.writeText(ticket.code); setCopied(true); } catch { setNotice("Không thể sao chép. Bạn có thể chọn mã vé và sao chép thủ công."); } }}>{copied ? <Check size={17} /> : <Copy size={17} />}</button></div><dl><div><dt>Khách hàng</dt><dd>{ticket.customerName || user.name}</dd></div><div><dt>Ghế</dt><dd>{ticket.seats.join(", ")}</dd></div><div><dt>Combo</dt><dd>{ticket.combos.length ? ticket.combos.map(combo => `${data.combos.find(item => item.id === combo.id)?.name || "Combo"} × ${combo.qty}`).join(", ") : "Không có"}</dd></div><div><dt>Thanh toán</dt><dd>{({ momo: "MoMo", bank: "Chuyển khoản", card: "Thẻ" })[ticket.paymentMethod]} · Giả lập</dd></div><div><dt>Tổng tiền</dt><dd>{money(ticket.total)}</dd></div></dl><button className="mg-primary" onClick={() => setTicket(null)}>Hoàn tất<Check size={17} /></button></div></Modal>}
  </div>;
}

function PointOfSale({ data, onComplete }: { data: Bootstrap; onComplete: (booking: Booking) => Promise<void> }) {
  const movies = data.movies.filter(movie => movie.status === "now");
  const [movieId, setMovieId] = useState(movies[0]?.id || "");
  const [showtimeId, setShowtimeId] = useState("");
  const [seats, setSeats] = useState<string[]>([]);
  const [occupied, setOccupied] = useState<string[]>([]);
  const [combos, setCombos] = useState<Record<string, number>>({});
  const [promo, setPromo] = useState("");
  const [payment, setPayment] = useState<"momo" | "bank" | "card">("bank");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
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
  useEffect(() => {
    if (!showtimeId) return;
    let active = true;
    void request<{ occupied: string[] }>(`/api/showtimes/${showtimeId}/seats`).then(result => { if (active) setOccupied(result.occupied); }).catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Không thể tải ghế."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showtimeId]);
  const submit = async () => {
    if (!show || !seats.length || saving) return;
    setSaving(true); setError("");
    try {
      const result = await request<{ booking: Booking }>("/api/bookings", { method: "POST", body: JSON.stringify({ showtimeId, seats, combos: Object.entries(combos).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })), promotionCode: promo.trim() || undefined, paymentMethod: payment }) });
      setConfirming(false); setSeats([]); setCombos({}); setPromo("");
      setOccupied(current => [...new Set([...current, ...result.booking.seats])]);
      await onComplete(result.booking);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không thể bán vé."); setConfirming(false);
      try { const latest = await request<{ occupied: string[] }>(`/api/showtimes/${showtimeId}/seats`); setOccupied(latest.occupied); setSeats(current => current.filter(seat => !latest.occupied.includes(seat))); } catch { /* original error shown */ }
    } finally { setSaving(false); }
  };
  return <div className="mg-pos-layout"><div className="mg-pos-main"><section className="mg-card mg-pos-selection"><div className="mg-card-title"><h2><span className="mg-step">01</span>Chọn suất chiếu</h2></div><div className="mg-pos-selects"><label className="mg-field"><span>Phim</span><select value={movieId} onChange={event => { setMovieId(event.target.value); setShowtimeId(""); setSeats([]); setOccupied([]); setError(""); setLoading(false); }}>{!movies.length && <option value="">Chưa có phim đang chiếu</option>}{movies.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label><label className="mg-field"><span>Suất chiếu</span><select value={showtimeId} onChange={event => { setShowtimeId(event.target.value); setSeats([]); setOccupied([]); setError(""); setLoading(Boolean(event.target.value)); }}><option value="">{shows.length ? "Chọn suất chiếu" : "Chưa có suất mở bán"}</option>{shows.map(item => <option key={item.id} value={item.id}>{when(item.startTime)} · {data.rooms.find(room => room.id === item.roomId)?.name} · {money(item.price)}</option>)}</select></label></div></section>
    <section className="mg-card mg-pos-seats"><div className="mg-card-title"><h2><span className="mg-step">02</span>Chọn ghế</h2>{room && <span className="mg-period">{room.name} · {room.type}</span>}</div>{error && <div className="mg-alert mg-alert-error" role="alert">{error}<button onClick={async () => { if (!showtimeId) return; setLoading(true); try { const result = await request<{ occupied: string[] }>(`/api/showtimes/${showtimeId}/seats`); setOccupied(result.occupied); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Không thể tải ghế."); } finally { setLoading(false); } }}>Tải lại ghế</button></div>}{!show || !room ? <Empty title="Chọn suất chiếu để xem sơ đồ ghế" detail="Tối đa 8 ghế trong mỗi đơn vé." icon={<Clapperboard size={30} />} /> : loading ? <div className="mg-loading"><RefreshCw size={21} className="mg-spin" />Đang cập nhật sơ đồ ghế…</div> : <><div className="mg-pos-screen"><div />MÀN HÌNH</div><div className="mg-seat-map"><div style={{ minWidth: `${room.cols * 35 + 35}px` }}>{Array.from({ length: room.rows }, (_, row) => <div className="mg-seat-row" key={row}><span>{String.fromCharCode(65 + row)}</span>{Array.from({ length: room.cols }, (_, col) => { const id = `${String.fromCharCode(65 + row)}${col + 1}`; const taken = occupied.includes(id); const selected = seats.includes(id); return <button key={id} type="button" aria-label={`Ghế ${id}${taken ? ", đã đặt" : selected ? ", đang chọn" : ", còn trống"}`} aria-pressed={selected} disabled={taken || saving || (!selected && seats.length >= 8)} className={`mg-seat ${taken ? "taken" : ""} ${selected ? "selected" : ""}`} onClick={() => setSeats(current => current.includes(id) ? current.filter(seat => seat !== id) : [...current, id])}>{col + 1}</button>; })}</div>)}</div></div><div className="mg-seat-legend"><span><i />Còn trống</span><span><i className="selected" />Đang chọn</span><span><i className="taken" />Đã đặt</span></div><p className="mg-pos-hint">{seats.length >= 8 ? "Đã đạt giới hạn 8 ghế. Bỏ chọn một ghế để đổi vị trí." : "Chọn tối đa 8 ghế. Ghế chỉ được giữ khi đơn được xác nhận."}</p></>}</section>
    <section className="mg-card mg-pos-combos"><div className="mg-card-title"><h2><span className="mg-step">03</span>Thêm bắp & nước<span className="mg-optional">Tùy chọn</span></h2></div>{data.combos.map(combo => <div className="mg-pos-combo" key={combo.id}><div><strong>{combo.name}</strong><p>{combo.description}</p><span>{money(combo.price)}</span></div><div className="mg-quantity"><button aria-label={`Giảm ${combo.name}`} disabled={!combos[combo.id] || saving} onClick={() => setCombos({ ...combos, [combo.id]: Math.max(0, (combos[combo.id] || 0) - 1) })}><Minus size={14} /></button><b>{combos[combo.id] || 0}</b><button aria-label={`Thêm ${combo.name}`} disabled={(combos[combo.id] || 0) >= 5 || saving} onClick={() => setCombos({ ...combos, [combo.id]: (combos[combo.id] || 0) + 1 })}><Plus size={14} /></button></div></div>)}</section>
  </div><aside className="mg-card mg-pos-summary"><div className="mg-card-title"><h2>Thông tin đơn vé</h2><Ticket size={20} /></div>{movie && <div className="mg-pos-movie"><img src={movie.poster} alt="" /><div><h3>{movie.title}</h3><span>{movie.ageRating} · {movie.duration} phút</span><p>{show ? when(show.startTime) : "Chưa chọn suất chiếu"}</p>{show && <span>{show.format} · {room?.name}</span>}</div></div>}<div className="mg-pos-order"><div><span>Ghế đã chọn</span><strong>{seats.length ? seats.join(", ") : "—"}</strong></div><div><span>Tiền vé ({seats.length})</span><strong>{money((show?.price || 0) * seats.length)}</strong></div>{Object.entries(combos).filter(([, qty]) => qty > 0).map(([id, qty]) => <div key={id}><span>{data.combos.find(item => item.id === id)?.name} × {qty}</span><strong>{money((data.combos.find(item => item.id === id)?.price || 0) * qty)}</strong></div>)}</div><label className="mg-field mg-promo-field"><span>Mã ưu đãi</span><input placeholder="Nhập mã (nếu có)" value={promo} disabled={saving} onChange={event => setPromo(event.target.value.toUpperCase())} />{promo && <small className={promotion ? "mg-accent" : ""}>{promotion ? `Đã áp dụng giảm ${promotion.discountPercent}%` : "Mã chưa hợp lệ hoặc đơn chưa đạt mức tối thiểu."}</small>}</label><label className="mg-field mg-payment-field"><span>Phương thức thanh toán giả lập</span><select value={payment} disabled={saving} onChange={event => setPayment(event.target.value as typeof payment)}><option value="bank">Chuyển khoản</option><option value="momo">Ví MoMo</option><option value="card">Thẻ ngân hàng</option></select></label>{promotion && <div className="mg-pos-discount"><span>Giảm giá</span><strong>−{money(subtotal - total)}</strong></div>}<div className="mg-pos-total"><span>Tổng thanh toán</span><strong>{money(total)}</strong></div><button className="mg-primary mg-pos-pay" disabled={!show || !seats.length || loading || saving || Boolean(error) || Boolean(promo && !promotion)} onClick={() => setConfirming(true)}><CreditCard size={18} />{saving ? "Đang phát hành…" : "Thanh toán & phát hành vé"}</button><p className="mg-pos-payment-note"><ShieldCheck size={14} />Giao dịch demo. Không thu tiền thật.<br />Đơn vé tại quầy được lưu theo tài khoản nhân viên.</p></aside>
    {confirming && <Modal title="Xác nhận thanh toán giả lập" onClose={() => { if (!saving) setConfirming(false); }}><p className="mg-confirm-description">Phát hành {seats.length} vé cho <strong>{movie?.title}</strong>, ghế <strong>{seats.join(", ")}</strong> tại {room?.name} · {show ? when(show.startTime) : ""}. Đơn sẽ được ghi nhận đã thanh toán với tổng {money(total)}. Không có tiền thật được giao dịch.</p><div className="mg-modal-actions"><button className="mg-secondary" disabled={saving} onClick={() => setConfirming(false)}>Quay lại</button><button className="mg-primary" disabled={saving} onClick={() => void submit()}>{saving ? <RefreshCw className="mg-spin" size={16} /> : <Check size={16} />}{saving ? "Đang phát hành…" : "Xác nhận thanh toán"}</button></div></Modal>}
  </div>;
}
