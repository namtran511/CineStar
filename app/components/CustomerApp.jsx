"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, Clock3, Copy, CreditCard, Film, LogOut, Menu, Minus, Play, Plus, Search, Send, ShieldCheck, Sparkles, Star, Ticket, UserRound, Utensils, X } from "lucide-react";
import { chatHistoryForRequest, AI_MESSAGE_LIMIT } from "@/lib/ai-chat";
import FeaturedMovies from "./FeaturedMovies";
import SiteFooter from "./SiteFooter";
import Membership, { MembershipNotice, MembershipCheckout } from "./Membership";
import MovieReviews, { MyReviews } from "./MovieReviews";
import { movieRatingLabel } from "@/lib/movie-rating";
import { movieTrailer } from "@/lib/movie-media";
import "./customer.css";
const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value);
const dateTime = (date) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
const clockTime = (date) => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" }).format(new Date(date));
const dateKey = (date) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(date));
    return ["year", "month", "day"].map(part => parts.find(item => item.type === part)?.value).join("-");
};
async function request(url, options) {
    const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
    const body = await response.json();
    if (!response.ok)
        throw new Error(body.error || "Đã có lỗi xảy ra. Vui lòng thử lại.");
    return body;
}
function Modal({ children, onClose, wide = false, title, className = "" }) {
    const ref = useRef(null);
    const closeRef = useRef(onClose);
    closeRef.current = onClose;
    useEffect(() => {
        const previous = document.activeElement;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        ref.current?.focus();
        const handle = (event) => {
            if (event.key === "Escape")
                closeRef.current();
            if (event.key === "Tab") {
                const elements = ref.current?.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]');
                if (!elements?.length)
                    return;
                const first = elements[0], last = elements[elements.length - 1];
                // A submitted form may move focus to a status heading or remove
                // the focused button. Keep the next Tab inside this dialog.
                if (![...elements].includes(document.activeElement)) {
                    event.preventDefault();
                    (event.shiftKey ? last : first).focus();
                    return;
                }
                if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
                    event.preventDefault();
                    last.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        window.addEventListener("keydown", handle);
        return () => { document.body.style.overflow = overflow; window.removeEventListener("keydown", handle); previous?.focus(); };
    }, []);
    return <div className="cv-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget)
        onClose(); }}><div ref={ref} className={`cv-modal ${wide ? "cv-modal-wide" : ""} ${className}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><button className="cv-icon-btn cv-modal-close" onClick={onClose} aria-label="Đóng"><X size={20}/></button>{children}</div></div>;
}
function MovieCard({ movie, onBook, onDetail }) {
    return <article className="cv-movie-card"><button className="cv-poster" onClick={() => onDetail(movie)} aria-label={`Xem chi tiết ${movie.title}`}><img src={movie.poster} alt={`Poster ${movie.title}`} loading="lazy"/><span className="cv-age">{movie.ageRating}</span><span className="cv-rating"><Star size={12} fill="currentColor"/> {movieRatingLabel(movie)}</span><span className="cv-poster-hover"><Play size={23} fill="currentColor"/> Xem chi tiết</span></button><div className="cv-card-genres">{movie.genres.slice(0, 2).join(" · ")}</div><button className="cv-movie-title" onClick={() => onDetail(movie)}>{movie.title}</button><div className="cv-card-bottom"><span><Clock3 size={13}/> {movie.duration} phút</span><button className="cv-small-book" onClick={() => onBook(movie)}>{movie.status === "coming" ? "Chi tiết" : "Đặt vé"}<ArrowUpRightIcon /></button></div></article>;
}
function ArrowUpRightIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 17 17 7M7 7h10v10"/></svg>; }
export default function CustomerApp({ user, onLogin, onManage, onLogout, data, onRefresh }) {
    const [view, setView] = useState("movies");
    const [status, setStatus] = useState("now");
    const [genre, setGenre] = useState("all");
    const [search, setSearch] = useState("");
    const [detail, setDetail] = useState(null);
    const [reviewVersion, setReviewVersion] = useState(0);
    const [bookingMovie, setBookingMovie] = useState(null);
    const [pendingMovie, setPendingMovie] = useState(null);
    const [startShowtime, setStartShowtime] = useState();
    const [profileOpen, setProfileOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [aiOpen, setAiOpen] = useState(false);
    const [copied, setCopied] = useState("");
    const genres = [...new Set(data.movies.flatMap(movie => movie.genres))];
    const filtered = data.movies.filter(movie => movie.status === status && (genre === "all" || movie.genres.includes(genre)) && `${movie.title} ${movie.originalTitle}`.toLowerCase().includes(search.toLowerCase()));
    const navigate = (next) => { setView(next); setMobileOpen(false); setProfileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
    const reviewed = (result) => {
        setDetail(current => current?.id === result.review.movieId ? { ...current, rating: result.rating, reviewCount: result.reviewCount } : current);
        setReviewVersion(value => value + 1);
    };
    const openAi = () => { setAiOpen(true); setMobileOpen(false); setProfileOpen(false); };
    const book = (movie, showtimeId) => {
        if (movie.status === "coming") {
            setDetail(movie);
            return;
        }
        setStartShowtime(showtimeId);
        setDetail(null);
        if (!user) {
            setPendingMovie(movie);
            onLogin();
            return;
        }
        setBookingMovie(movie);
    };
    useEffect(() => { if (user && pendingMovie) {
        setBookingMovie(pendingMovie);
        setPendingMovie(null);
    } }, [user, pendingMovie]);
    const copyCode = async (code) => { try {
        await navigator.clipboard.writeText(code);
        setCopied(code);
    }
    catch {
        setCopied("");
    } };
    return <div className="cv-app">
    <header className="cv-header"><div className="cv-header-inner"><button className="cv-logo" onClick={() => navigate("movies")} aria-label="Trang chủ CineStar"><span className="cv-logo-icon"><Film size={23} strokeWidth={1.7}/></span>Cine<span>Star</span><span className="cv-logo-dot">.</span></button><nav className={`cv-nav ${mobileOpen ? "cv-nav-mobile-open" : ""}`} aria-label="Điều hướng chính"><button className={view === "movies" ? "active" : ""} onClick={() => navigate("movies")}>Phim</button><button className={view === "schedule" ? "active" : ""} onClick={() => navigate("schedule")}>Lịch chiếu</button><button className={view === "promotions" ? "active" : ""} onClick={() => navigate("promotions")}>Ưu đãi</button><button className="cv-nav-ai" aria-haspopup="dialog" aria-expanded={aiOpen} onClick={openAi}><Sparkles size={15}/> AI gợi ý</button></nav><div className="cv-header-actions"><button className="cv-header-ticket" onClick={() => navigate("tickets")}><Ticket size={16}/><span>Vé của tôi</span></button><div className="cv-nav-divider"/>{user ? <div className="cv-profile"><button className="cv-profile-toggle" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}><span className="cv-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span>{user.name.split(" ").slice(-1)}</span><ChevronDown size={13}/></button>{profileOpen && <div className="cv-profile-menu"><strong>{user.name}</strong><small>{user.email}</small><button onClick={() => navigate("tickets")}><Ticket size={15}/> Vé của tôi</button>{user.role === "user" && <button onClick={() => navigate("membership")}><CreditCard size={15}/> Thẻ thành viên · {data.membership?.points || 0} điểm</button>}{user.role === "user" && <button onClick={() => navigate("reviews")}><Star size={15}/> Đánh giá của tôi</button>}{user.role !== "user" && <button onClick={onManage}><ShieldCheck size={15}/> {user.role === "admin" ? "Quản trị hệ thống" : "Quầy nhân viên"}</button>}<button onClick={() => { setProfileOpen(false); onLogout(); }}><LogOut size={15}/> Đăng xuất</button></div>}</div> : <button className="cv-login" onClick={onLogin}><UserRound size={15}/> Đăng nhập</button>}<button className="cv-icon-btn cv-mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Mở menu"><Menu size={22}/></button></div></div></header>

    <MembershipNotice membership={data.membership} onOpen={() => navigate("membership")}/>
    {view === "membership" && <Membership user={user} onLogin={onLogin} onRefresh={onRefresh} onExplore={() => navigate("movies")}/>}
    {view === "movies" && <>
      <FeaturedMovies movies={data.movies} suspended={aiOpen || Boolean(detail || bookingMovie || pendingMovie)} onBook={book} onDetail={setDetail}/>

      <main className="cv-container"><section id="movie-list" className="cv-movies-section"><div className="cv-section-heading"><div><div className="cv-section-kicker">YOUR NEXT FAVORITE STORY</div><h2>Hôm nay, xem gì?</h2></div><div className="cv-movie-tabs" role="tablist" aria-label="Trạng thái phim"><button role="tab" aria-selected={status === "now"} className={status === "now" ? "active" : ""} onClick={() => setStatus("now")}>Đang chiếu<span>{data.movies.filter(movie => movie.status === "now").length}</span></button><button role="tab" aria-selected={status === "coming"} className={status === "coming" ? "active" : ""} onClick={() => setStatus("coming")}>Sắp chiếu</button></div></div><div className="cv-film-toolbar"><div className="cv-genre-chips"><button className={genre === "all" ? "active" : ""} onClick={() => setGenre("all")}>Tất cả</button>{genres.slice(0, 4).map(item => <button key={item} className={genre === item ? "active" : ""} onClick={() => setGenre(item)}>{item}</button>)}<select aria-label="Chọn thể loại phim" value={genre} onChange={event => setGenre(event.target.value)}><option value="all">Thể loại khác</option>{genres.map(item => <option key={item} value={item}>{item}</option>)}</select></div><label className="cv-search"><Search size={16}/><input placeholder="Tìm phim bạn yêu thích..." aria-label="Tìm kiếm phim" value={search} onChange={event => setSearch(event.target.value)}/>{search && <button onClick={() => setSearch("")} aria-label="Xóa tìm kiếm"><X size={14}/></button>}</label></div><div className="cv-movie-grid">{filtered.map(movie => <MovieCard key={movie.id} movie={movie} onBook={book} onDetail={setDetail}/>)}</div>{!filtered.length && <div className="cv-empty"><Film size={32}/><h3>Chưa tìm thấy phim phù hợp</h3><p>Thử một thể loại khác hoặc thay đổi từ khóa tìm kiếm.</p><button className="cv-btn cv-btn-outline" onClick={() => { setSearch(""); setGenre("all"); }}>Xem tất cả phim</button></div>}</section>
      <section className="cv-ai-banner"><div className="cv-ai-banner-orbit"><Sparkles size={27}/></div><div><div className="cv-section-kicker">A LITTLE AI. A LOT OF MOVIE MAGIC.</div><h2>Phim hay, đúng gu bạn.</h2><p>Chưa biết xem gì? Để trợ lý AI tìm câu chuyện dành riêng cho bạn.</p></div><button className="cv-btn cv-btn-primary" onClick={openAi}><Sparkles size={16}/> Khám phá cùng AI<ArrowRight size={17}/></button></section>
      <section className="cv-experience"><div className="cv-section-heading"><div><div className="cv-section-kicker">MORE THAN A MOVIE</div><h2>Trọn vẹn từng khoảnh khắc.</h2></div><button className="cv-text-link" onClick={() => navigate("promotions")}>Khám phá ưu đãi<ArrowRight size={16}/></button></div><div className="cv-experience-grid"><button className="cv-experience-card cv-experience-popcorn" onClick={() => navigate("promotions")}><span className="cv-experience-art"><Utensils size={74} strokeWidth={1}/></span><span className="cv-experience-label">BẮP NGON. PHIM HAY.</span><h3>Combo cho<br />mọi cuộc hẹn.</h3><span className="cv-experience-link">Chọn combo yêu thích<ArrowRight size={17}/></span></button><button className="cv-experience-card cv-experience-screen" onClick={() => navigate("schedule")}><span className="cv-experience-art"><Film size={80} strokeWidth={1}/></span><span className="cv-experience-label">ĐIỆN ẢNH KHÔNG GIỚI HẠN</span><h3>Màn ảnh lớn.<br />Cảm xúc lớn hơn.</h3><span className="cv-experience-link">Tìm suất chiếu của bạn<ArrowRight size={17}/></span></button><button className="cv-experience-card cv-experience-member" onClick={() => user ? navigate("tickets") : onLogin()}><span className="cv-experience-art"><Ticket size={83} strokeWidth={1}/></span><span className="cv-experience-label">CÂU CHUYỆN CỦA CHÚNG TA</span><h3>Mỗi tấm vé.<br />Một kỷ niệm.</h3><span className="cv-experience-link">{user ? "Xem vé của bạn" : "Tham gia CineStar"}<ArrowRight size={17}/></span></button></div></section></main>
    </>}
    {view === "schedule" && <ScheduleView data={data} onBook={book} onDetail={setDetail}/>}
    {view === "promotions" && <main className="cv-container cv-inner-page"><div className="cv-page-heading"><div className="cv-section-kicker">GOOD MOVIES. GREAT DEALS.</div><h1>Niềm vui thêm một chút.</h1><p>Ưu đãi và combo để cuộc hẹn điện ảnh trở nên trọn vẹn hơn.</p></div><h2 className="cv-subheading">Ưu đãi dành cho bạn</h2><div className="cv-promo-grid">{data.promotions.filter(promo => promo.active).map((promo, index) => <article className={`cv-promo-card cv-promo-${index % 3}`} key={promo.id}><span className="cv-promo-kicker">CINESTAR SPECIAL</span><div className="cv-promo-percent">{promo.discountPercent}<span>%<small>OFF</small></span></div><h3>Thêm cảm xúc. Bớt chi phí.</h3><p>Giảm {promo.discountPercent}% cho đơn từ {money(promo.minTotal)}.</p><div className="cv-promo-code"><span>{promo.code}</span><button onClick={() => copyCode(promo.code)} aria-label={`Sao chép mã ${promo.code}`}>{copied === promo.code ? <><Check size={15}/> Đã chép</> : <><Copy size={15}/> Sao chép</>}</button></div><small>Nhập mã tại bước thanh toán để áp dụng.</small></article>)}</div><h2 className="cv-subheading">Vị ngon của điện ảnh</h2><div className="cv-combo-grid">{data.combos.map(combo => <article className="cv-combo-card" key={combo.id}><div className="cv-combo-art">{combo.image ? <img src={combo.image} alt={combo.name}/> : <Utensils size={55}/>}</div><div><h3>{combo.name}</h3><p>{combo.description}</p><strong>{money(combo.price)}</strong></div><button className="cv-text-link" onClick={() => navigate("schedule")}>Chọn phim & thêm combo<ArrowRight size={16}/></button></article>)}</div></main>}

    {view === "tickets" && <TicketsView user={user} data={data} onLogin={onLogin} onExplore={() => navigate("movies")} onRefresh={onRefresh} onReviews={() => navigate("reviews")} onDetail={setDetail}/>}
    {view === "reviews" && <MyReviews key={`${user?.id || "guest"}:${reviewVersion}`} user={user} onLogin={onLogin} onExplore={() => navigate("movies")} onDetail={setDetail} onRefresh={onRefresh}/>}

    <SiteFooter navigate={navigate} openAi={openAi} cinema={data.cinema}/>
    <AiDialog open={aiOpen} onClose={() => setAiOpen(false)} data={data} onBook={movie => { setAiOpen(false); book(movie); }} onDetail={movie => { setAiOpen(false); setDetail(movie); }}/>
    {detail && <Modal title={`Chi tiết ${detail.title}`} onClose={() => setDetail(null)} wide><div className="cv-detail-backdrop" style={{ backgroundImage: `url('${detail.backdrop || "/images/hero.jpg"}')` }}/><div className="cv-detail-content"><img className="cv-detail-poster" src={detail.poster} alt={detail.title}/><div><span className="cv-now-pill">{detail.status === "now" ? "ĐANG CHIẾU" : "SẮP CHIẾU"}</span><h2>{detail.title}</h2><p className="cv-detail-original">{detail.originalTitle}</p><div className="cv-detail-meta"><span className="cv-age">{detail.ageRating}</span><span><Star size={14} fill="currentColor"/> {movieRatingLabel(detail)} {detail.reviewCount > 0 && `(${detail.reviewCount} lượt)`}</span><span><Clock3 size={14}/> {detail.duration} phút</span></div><div className="cv-detail-genres">{detail.genres.map(item => <span key={item}>{item}</span>)}</div><p className="cv-detail-description">{detail.description}</p>{movieTrailer(detail) && <a className="cv-btn cv-btn-glass" href={movieTrailer(detail)} target="_blank" rel="noopener noreferrer"><Play size={15}/> Xem trailer</a>}<dl className="cv-detail-facts"><div><dt>Đạo diễn</dt><dd>{detail.director}</dd></div><div><dt>Diễn viên</dt><dd>{detail.cast.join(", ")}</dd></div><div><dt>Khởi chiếu</dt><dd>{new Date(detail.releaseDate).toLocaleDateString("vi-VN")}</dd></div></dl>{detail.status === "now" ? <button className="cv-btn cv-btn-primary" onClick={() => book(detail)}><Ticket size={17}/> Chọn suất chiếu<ArrowRight size={17}/></button> : <p className="cv-coming-note"><CalendarDays size={17}/> Suất chiếu sẽ được cập nhật khi phim ra mắt.</p>}</div></div><MovieReviews movie={detail} user={user} onLogin={() => { setDetail(null); onLogin(); }} onRefresh={onRefresh} onReviewed={reviewed} onRatingLoaded={summary => setDetail(current => current?.id === detail.id && (current.rating !== summary.rating || current.reviewCount !== summary.reviewCount) ? { ...current, ...summary } : current)}/></Modal>}
    {bookingMovie && <BookingModal movie={bookingMovie} data={data} startShowtime={startShowtime} onClose={() => { setBookingMovie(null); setStartShowtime(undefined); }} onRefresh={onRefresh}/>}
  </div>;
}
function ScheduleView({ data, onBook, onDetail }) {
    const future = data.showtimes.filter(show => new Date(show.startTime).getTime() > Date.now() + 10 * 60 * 1000);
    const days = [...new Set(future.map(show => dateKey(show.startTime)))].sort();
    const [day, setDay] = useState(days[0] || "");
    const [movieId, setMovieId] = useState("all");
    const selected = days.includes(day) ? day : days[0];
    const movies = data.movies.filter(movie => (movieId === "all" || movie.id === movieId) && future.some(show => show.movieId === movie.id && dateKey(show.startTime) === selected));
    return <main className="cv-container cv-inner-page"><div className="cv-page-heading"><div className="cv-section-kicker">MAKE TIME FOR A GOOD STORY</div><h1>Hẹn bạn tại rạp.</h1><p>Chọn thời gian phù hợp. Phần còn lại, để điện ảnh dẫn lối.</p></div><div className="cv-schedule-toolbar"><div className="cv-date-strip">{days.map(item => { const date = new Date(`${item}T12:00:00+07:00`); return <button key={item} className={selected === item ? "active" : ""} onClick={() => setDay(item)}><span>{date.toLocaleDateString("vi-VN", { weekday: "short" })}</span><strong>{date.getDate().toString().padStart(2, "0")}</strong><small>Tháng {date.getMonth() + 1}</small></button>; })}</div><label className="cv-select-label">Chọn phim<select value={movieId} onChange={event => setMovieId(event.target.value)}><option value="all">Tất cả phim</option>{data.movies.filter(movie => movie.status === "now").map(movie => <option key={movie.id} value={movie.id}>{movie.title}</option>)}</select></label></div><div className="cv-schedule-list">{movies.map(movie => <article className="cv-schedule-card" key={movie.id}><button className="cv-schedule-poster" onClick={() => onDetail(movie)}><img src={movie.poster} alt={movie.title}/></button><div className="cv-schedule-info"><span className="cv-card-genres">{movie.genres.join(" · ")}</span><h2><button onClick={() => onDetail(movie)}>{movie.title}</button></h2><div className="cv-schedule-meta"><span className="cv-age">{movie.ageRating}</span><span><Clock3 size={14}/> {movie.duration} phút</span><span><Star size={14}/> {movieRatingLabel(movie)}</span></div><div className="cv-showtime-buttons">{future.filter(show => show.movieId === movie.id && dateKey(show.startTime) === selected).sort((a, b) => a.startTime.localeCompare(b.startTime)).map(show => <button key={show.id} onClick={() => onBook(movie, show.id)}><strong>{clockTime(show.startTime)}</strong><span>{show.format} · {money(show.price)}</span></button>)}</div></div></article>)}</div>{!movies.length && <div className="cv-empty"><CalendarDays size={34}/><h3>Chưa có suất chiếu</h3><p>Hãy quay lại sau để xem lịch chiếu mới nhất.</p></div>}</main>;
}
function AiDialog({ open, onClose, data, onBook, onDetail }) {
    const [messages, setMessages] = useState([{ role: "assistant", text: "Chào bạn, mình là trợ lý điện ảnh CineStar. Bạn thích cảm giác hồi hộp, một câu chuyện ấm áp hay chuyến phiêu lưu đến thế giới khác? Mình có thể gợi ý phim, lịch chiếu và ưu đãi từ dữ liệu của rạp." }]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [mode, setMode] = useState(null);
    const isDemo = mode === "demo" || (!data.aiConfigured && mode !== "gemini");
    const statusMessage = mode === "gemini" ? "Được hỗ trợ bởi Gemini"
        : !data.aiConfigured ? "Chế độ demo · Chưa cấu hình Gemini"
            : mode === "demo" ? "Chế độ demo · Gemini tạm không khả dụng"
                : "Gemini đã cấu hình · Sẵn sàng";
    const messagesRef = useRef(null);
    useEffect(() => {
        if (open)
            messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, loading, open]);
    const send = async (value = input) => {
        const text = value.trim();
        if (!text || loading)
            return;
        const history = chatHistoryForRequest(messages.slice(1));
        setInput("");
        setError("");
        setMessages(previous => [...previous, { role: "user", text }]);
        setLoading(true);
        try {
            const result = await request("/api/ai", { method: "POST", body: JSON.stringify({ message: text, history }) });
            if (result.scope === "catalog")
                setMode(result.mode);
            setMessages(previous => [...previous, { role: "assistant", text: result.message, movieIds: result.movieIds, mode: result.mode }]);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Không thể kết nối trợ lý.");
            setInput(text);
        }
        finally {
            setLoading(false);
        }
    };
    if (!open)
        return null;
    return <Modal title="Gợi ý phim cùng AI" onClose={onClose} wide className="cv-ai-modal">
    <div className="cv-ai-dialog-heading"><div className="cv-section-kicker">MEET YOUR MOVIE MATCH</div><h2>Gu của bạn. Gợi ý của AI.</h2><p>Một cuộc trò chuyện nhỏ, một bộ phim thật hợp ý.</p></div>
    <div className="cv-ai-layout">
      <aside className="cv-ai-sidebar">
        <div className="cv-ai-orb"><Sparkles size={38} strokeWidth={1.3}/></div><h2>Trợ lý CineStar</h2><p>Đưa tâm trạng của bạn đến đúng màn ảnh.</p>
        <span className={`cv-ai-mode ${isDemo ? "demo" : ""}`}><span /> {statusMessage}</span>
        <div className="cv-ai-scope"><ShieldCheck size={18}/><p>Chỉ sử dụng dữ liệu của CineStar: phim, suất chiếu, phòng chiếu, combo và ưu đãi.</p></div>
        <h3>Bắt đầu từ một ý tưởng</h3><div className="cv-ai-prompts">{["Tôi yếu bóng vía, nên xem phim nào?", "Có phim nào phù hợp cho gia đình?", "Tôi muốn xem phim tối nay", "Rạp đang có ưu đãi gì?"].map(value => <button className="cv-ai-prompt" key={value} disabled={loading} onClick={() => send(value)}>{value}<ArrowUpRightIcon /></button>)}</div>
        <span className="cv-ai-sidebar-note">Khi chưa cấu hình API, gợi ý được tạo từ dữ liệu bằng chế độ demo.</span>
      </aside>
      <section className="cv-chat-panel">
        <div className="cv-chat-header"><span className="cv-chat-avatar"><Sparkles size={17}/></span><div><strong>Một bộ phim đang chờ bạn</strong><small>Khám phá cùng trợ lý điện ảnh</small></div><span className="cv-chat-online"><i /> Sẵn sàng</span></div>
        <div ref={messagesRef} className="cv-chat-messages" role="log" aria-label="Cuộc trò chuyện với trợ lý AI" aria-live="polite" aria-busy={loading}>
          {messages.map((message, index) => <div key={index} className={`cv-chat-message ${message.role}`}>
            <span className="cv-chat-message-icon">{message.role === "assistant" ? <Sparkles size={17}/> : <UserRound size={17}/>}</span>
            <div className="cv-chat-message-body"><div className="cv-chat-bubble">{message.text}</div>
              {!!message.movieIds?.length && <div className="cv-chat-recommendations">{message.movieIds.map(id => data.movies.find(movie => movie.id === id)).filter((movie) => !!movie).map(movie => <article key={movie.id}>
                <button onClick={() => onDetail(movie)} aria-label={`Xem chi tiết ${movie.title}`}><img src={movie.poster} alt={movie.title}/></button>
                <div><span><Star size={11} fill="currentColor"/> {movieRatingLabel(movie)} · {movie.duration} phút</span><h3><button onClick={() => onDetail(movie)}>{movie.title}</button></h3><button className="cv-text-link" onClick={() => onBook(movie)}>{movie.status === "coming" ? "Xem chi tiết" : "Đặt vé"}<ArrowRight size={13}/></button></div>
              </article>)}</div>}
            </div>
          </div>)}
          {loading && <div className="cv-chat-message assistant"><span className="cv-chat-message-icon"><Sparkles size={17}/></span><div className="cv-chat-bubble cv-typing"><i /><i /><i /><span>Đang cân nhắc lựa chọn phù hợp với bạn...</span></div></div>}
        </div>
        {error && <div className="cv-error" role="alert">{error}</div>}
        <form className="cv-chat-form" onSubmit={event => { event.preventDefault(); send(); }}><input value={input} onChange={event => setInput(event.target.value)} placeholder="Kể mình nghe tâm trạng hoặc buổi xem phim bạn muốn..." aria-label="Tin nhắn cho trợ lý AI" maxLength={AI_MESSAGE_LIMIT} disabled={loading}/><button disabled={loading || !input.trim()} aria-label="Gửi tin nhắn"><Send size={18}/></button></form>
        <p className="cv-chat-footnote"><ShieldCheck size={11}/> Gợi ý giới hạn trong cơ sở dữ liệu rạp. Hãy kiểm tra suất chiếu trước khi đặt vé.</p>
      </section>
    </div>
  </Modal>;
}
function TicketsView({ user, data, onLogin, onExplore, onRefresh, onReviews, onDetail }) {
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [cancelId, setCancelId] = useState(null);
    const [busy, setBusy] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const load = async () => { setLoading(true); setError(""); try {
        const result = await request("/api/bookings");
        setBookings(result.bookings);
    }
    catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được vé.");
    }
    finally {
        setLoading(false);
    } };
    useEffect(() => { if (user) {
        void load();
    }
    else {
        setLoading(false);
        setBookings([]);
    } }, [user]);
    const cancel = async () => { if (!cancelId)
        return; setBusy(true); setError(""); try {
        await request(`/api/bookings/${cancelId}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) });
        setCancelId(null);
        await load();
        await onRefresh();
    }
    catch (err) {
        setError(err instanceof Error ? err.message : "Không thể hủy vé.");
    }
    finally {
        setBusy(false);
    } };
    return <main className="cv-container cv-inner-page"><div className="cv-page-heading"><div className="cv-section-kicker">YOUR CINEMA MEMORIES</div><h1>Những cuộc hẹn với điện ảnh.</h1><p>Tất cả vé và những câu chuyện bạn đã chọn, ngay tại đây.</p>{user?.role === "user" && <button className="cv-text-link cv-tickets-review-link" onClick={onReviews}><Star size={16}/> Phim đã xem & đánh giá của tôi<ArrowRight size={15}/></button>}</div>{!user ? <div className="cv-empty"><Ticket size={40}/><h3>Đăng nhập để xem vé của bạn</h3><p>Quản lý vé, xem mã đặt chỗ và theo dõi các suất chiếu sắp tới.</p><button className="cv-btn cv-btn-primary" onClick={onLogin}><UserRound size={16}/> Đăng nhập</button></div> : loading ? <div className="cv-empty"><div className="cv-spinner"/><p>Đang tải vé của bạn...</p></div> : <>{error && <div className="cv-error" role="alert">{error}<button onClick={load}>Thử lại</button></div>}{!bookings.length && !error ? <div className="cv-empty"><Ticket size={40}/><h3>Câu chuyện đầu tiên đang chờ bạn</h3><p>Bạn chưa có vé nào. Khám phá phim và chọn cuộc hẹn tiếp theo.</p><button className="cv-btn cv-btn-primary" onClick={onExplore}>Khám phá phim<ArrowRight size={16}/></button></div> : <div className="cv-tickets-list">{bookings.map(booking => { const show = data.showtimes.find(item => item.id === booking.showtimeId); const movie = data.movies.find(item => item.id === show?.movieId); return <article className={`cv-ticket-card ${booking.status === "cancelled" ? "cancelled" : ""}`} key={booking.id}><img src={movie?.poster || "/images/dune.jpg"} alt={booking.movieTitle}/><div className="cv-ticket-info"><span className={`cv-ticket-status ${booking.status}`}>{booking.status === "paid" ? "Đã thanh toán" : booking.status === "checked_in" ? "Đã soát vé" : "Đã hủy"}</span><h2>{booking.movieTitle}</h2><div className="cv-ticket-meta"><span><CalendarDays size={15}/> {dateTime(booking.startTime)}</span><span>{booking.roomName}</span><span>Ghế {booking.seats.join(", ")}</span></div><div className="cv-ticket-actions"><button className="cv-text-link" onClick={() => setSelectedTicket(booking)}>Xem vé<ArrowRight size={14}/></button>{user?.role === "user" && booking.status === "checked_in" && movie && Date.parse(booking.startTime) + movie.duration * 60000 <= Date.now() && <button className="cv-text-link" onClick={() => onDetail(movie)}><Star size={14}/> Đánh giá phim</button>}{booking.status === "paid" && new Date(booking.startTime).getTime() > Date.now() + 60 * 60 * 1000 && <button className="cv-cancel-link" onClick={() => setCancelId(booking.id)}>Hủy vé</button>}</div></div><div className="cv-ticket-stub"><Ticket size={22}/><strong>{booking.code}</strong><span>{money(booking.total)}</span><small>Thanh toán giả lập</small></div></article>; })}</div>}</>}{cancelId && <Modal title="Xác nhận hủy vé" onClose={() => !busy && setCancelId(null)}><div className="cv-confirm"><Ticket size={35}/><h2>Hủy cuộc hẹn này?</h2><p>Chỉ hủy vé trước giờ chiếu ít nhất 60 phút. Ghế của bạn sẽ được mở lại cho người khác. Đơn thanh toán giả lập sẽ chuyển sang trạng thái đã hủy.</p><div><button className="cv-btn cv-btn-outline" disabled={busy} onClick={() => setCancelId(null)}>Giữ vé</button><button className="cv-btn cv-btn-primary" disabled={busy} onClick={cancel}>{busy ? "Đang hủy..." : "Xác nhận hủy"}</button></div>{error && <p className="cv-error">{error}</p>}</div></Modal>}{selectedTicket && <Modal title="Chi tiết vé" onClose={() => setSelectedTicket(null)}><TicketDisplay booking={selectedTicket} onDone={() => setSelectedTicket(null)}/></Modal>}</main>;
}
function TicketDisplay({ booking, onDone }) {
    return <div className="cv-success"><div className="cv-success-icon"><CheckCircle2 size={34}/></div><span className="cv-section-kicker">SEE YOU AT THE MOVIES</span><h2>{booking.status === "cancelled" ? "Vé đã được hủy" : "Tấm vé cho câu chuyện mới."}</h2><p>{booking.status === "checked_in" ? "Vé đã được soát tại rạp." : booking.status === "cancelled" ? "Ghế đã được trả lại cho hệ thống." : "Đưa mã đặt vé này cho nhân viên khi đến rạp."}</p><div className="cv-digital-ticket"><span className="cv-ticket-film-label">CINESTAR CINEMA</span><h3>{booking.movieTitle}</h3><div className="cv-digital-ticket-grid"><div><small>SUẤT CHIẾU</small><strong>{dateTime(booking.startTime)}</strong></div><div><small>PHÒNG CHIẾU</small><strong>{booking.roomName}</strong></div><div><small>GHẾ CỦA BẠN</small><strong>{booking.seats.join(", ")}</strong></div><div><small>TỔNG THANH TOÁN</small><strong>{money(booking.total)}</strong></div></div><div className="cv-ticket-code"><div className="cv-barcode" aria-hidden="true"/><strong>{booking.code}</strong><small>Mã đặt vé · Thanh toán giả lập</small></div></div><button className="cv-btn cv-btn-primary" onClick={onDone}>Hoàn tất<Check size={16}/></button></div>;
}
function BookingModal({ movie, data, startShowtime, onClose, onRefresh }) {
    const showtimes = data.showtimes.filter(show => show.movieId === movie.id && new Date(show.startTime).getTime() > Date.now() + 10 * 60 * 1000).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const [showId, setShowId] = useState(startShowtime || showtimes[0]?.id || "");
    const [step, setStep] = useState(startShowtime ? 1 : 0);
    const [seats, setSeats] = useState([]);
    const [occupied, setOccupied] = useState([]);
    const [seatsLoading, setSeatsLoading] = useState(false);
    const [seatLoadError, setSeatLoadError] = useState("");
    const [quantities, setQuantities] = useState({});
    const [promoInput, setPromoInput] = useState("");
    const [promoCode, setPromoCode] = useState("");
    const [promoError, setPromoError] = useState("");
    const [method, setMethod] = useState("momo");
    const [memberBenefit, setMemberBenefit] = useState({ redeemPoints: 0, useBirthday: false, rewardId: "" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [ticket, setTicket] = useState(null);
    const show = showtimes.find(item => item.id === showId);
    const room = data.rooms.find(item => item.id === show?.roomId);
    const seatTotal = seats.length * (show?.price || 0);
    const comboTotal = data.combos.reduce((total, combo) => total + combo.price * (quantities[combo.id] || 0), 0);
    const subtotal = seatTotal + comboTotal;
    const promo = data.promotions.find(item => item.code.toUpperCase() === promoCode.toUpperCase() && item.active && subtotal >= item.minTotal);
    const membership = data.membership;
    const redeemPoints = promo ? 0 : Math.min(memberBenefit.redeemPoints, membership?.points || 0, Math.floor(subtotal * .3 / 1000));
    const useBirthday = !promo && memberBenefit.useBirthday && membership?.birthday.active && !membership.birthday.used;
    const rewardId = !promo && membership?.redemptions.some(item => item.id === memberBenefit.rewardId && item.type === "ticket" && item.status === "available") ? memberBenefit.rewardId : "";
    const total = promo ? Math.round(subtotal * (100 - promo.discountPercent) / 100) : useBirthday ? Math.round(subtotal * .8) : Math.max(0, subtotal - redeemPoints * 1000 - (rewardId ? show?.price || 0 : 0));
    const discount = subtotal - total;
    const [seatReload, setSeatReload] = useState(0);
    useEffect(() => {
        if (!showId)
            return;
        let cancelled = false;
        setSeatsLoading(true);
        setSeatLoadError("");
        setOccupied([]);
        request(`/api/showtimes/${showId}/seats`).then(result => { if (!cancelled) {
            setOccupied(result.occupied);
            setSeats(previous => previous.filter(seat => !result.occupied.includes(seat)));
        } }).catch(err => { if (!cancelled)
            setSeatLoadError(err instanceof Error ? err.message : "Không tải được sơ đồ ghế."); }).finally(() => { if (!cancelled)
            setSeatsLoading(false); });
        return () => { cancelled = true; };
    }, [showId, seatReload]);
    const selectShow = (id) => { setShowId(id); setSeats([]); setError(""); };
    const toggleSeat = (seat) => { setError(""); setSeats(previous => previous.includes(seat) ? previous.filter(item => item !== seat) : previous.length >= 8 ? (setError("Mỗi đơn được chọn tối đa 8 ghế."), previous) : [...previous, seat]); };
    const applyPromo = () => { const code = promoInput.trim().toUpperCase(); const found = data.promotions.find(item => item.code.toUpperCase() === code && item.active); if (!found) {
        setPromoError("Mã ưu đãi không tồn tại hoặc đã hết hiệu lực.");
        setPromoCode("");
    }
    else if (subtotal < found.minTotal) {
        setPromoError(`Đơn hàng cần đạt ${money(found.minTotal)} để áp dụng mã này.`);
        setPromoCode("");
    }
    else {
        setPromoCode(code);
        setMemberBenefit({ redeemPoints: 0, useBirthday: false, rewardId: "" });
        setPromoError("");
    } };
    const checkout = async () => {
        if (!show || !seats.length || busy)
            return;
        setBusy(true);
        setError("");
        try {
            const result = await request("/api/bookings", { method: "POST", body: JSON.stringify({ showtimeId: show.id, seats, combos: Object.entries(quantities).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })), ...(promo ? { promotionCode: promo.code } : { redeemPoints, useBirthday: Boolean(useBirthday), rewardId }), paymentMethod: method }) });
            setTicket(result.booking);
            await onRefresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Đặt vé chưa thành công. Vui lòng thử lại.");
            setSeatReload(previous => previous + 1);
        }
        finally {
            setBusy(false);
        }
    };
    const steps = ["Suất chiếu", "Chọn ghế", "Bắp & nước", "Thanh toán"];
    return <Modal title={`Đặt vé ${movie.title}`} wide onClose={() => !busy && onClose()}>{ticket ? <TicketDisplay booking={ticket} onDone={onClose}/> : <><div className="cv-booking-heading"><span className="cv-section-kicker">YOUR NEXT CINEMA DATE</span><h2>Đặt vé của bạn</h2><div className="cv-booking-steps">{steps.map((item, index) => <div className={step === index ? "active" : step > index ? "complete" : ""} key={item}><span>{step > index ? <Check size={13}/> : index + 1}</span>{item}{index < steps.length - 1 && <i />}</div>)}</div></div><div className="cv-booking-layout"><div className="cv-booking-main">
    {step === 0 && <><h3><CalendarDays size={19}/> Chọn một cuộc hẹn</h3><p className="cv-booking-hint">Các suất chiếu còn nhận đặt vé, theo giờ Việt Nam.</p><div className="cv-booking-showtimes">{[...new Set(showtimes.map(item => dateKey(item.startTime)))].map(day => <div key={day}><h4>{new Date(`${day}T12:00:00+07:00`).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit" })}</h4><div>{showtimes.filter(item => dateKey(item.startTime) === day).map(item => <button key={item.id} className={showId === item.id ? "active" : ""} onClick={() => selectShow(item.id)}><strong>{clockTime(item.startTime)}</strong><span>{item.format} · {data.rooms.find(value => value.id === item.roomId)?.name}</span><small>{money(item.price)}</small></button>)}</div></div>)}</div>{!showtimes.length && <div className="cv-empty"><CalendarDays size={32}/><h3>Chưa có suất chiếu</h3><p>Phim hiện chưa có suất chiếu mở bán. Hãy chọn một phim khác.</p></div>}</>}
    {step === 1 && <><h3><Ticket size={19}/> Chọn vị trí yêu thích</h3><p className="cv-booking-hint">Tối đa 8 ghế mỗi đơn · {room?.name} · {show?.format}</p><div className="cv-seat-screen"><span>MÀN HÌNH</span></div>{seatsLoading ? <div className="cv-seat-loading"><div className="cv-spinner"/><span>Đang kiểm tra ghế trống...</span></div> : room && <div className="cv-seat-scroll"><div className="cv-seat-map" style={{ minWidth: `${room.cols * 34 + 54}px` }}>{Array.from({ length: room.rows }, (_, row) => <div className="cv-seat-row" key={row}><span className="cv-seat-row-label">{String.fromCharCode(65 + row)}</span>{Array.from({ length: room.cols }, (_, col) => { const label = `${String.fromCharCode(65 + row)}${col + 1}`; return <button key={col} title={`Ghế ${label}`} aria-label={`Ghế ${label}${occupied.includes(label) ? ", đã đặt" : seats.includes(label) ? ", đang chọn" : ", còn trống"}`} aria-pressed={seats.includes(label)} className={`${occupied.includes(label) ? "occupied" : ""} ${seats.includes(label) ? "selected" : ""} ${col === Math.floor(room.cols / 2) - 1 ? "cv-seat-aisle" : ""}`} disabled={occupied.includes(label) || !!seatLoadError} onClick={() => toggleSeat(label)}>{col + 1}</button>; })}<span className="cv-seat-row-label">{String.fromCharCode(65 + row)}</span></div>)}</div></div>}{seatLoadError && <div className="cv-error" role="alert">{seatLoadError}<button onClick={() => setSeatReload(previous => previous + 1)}>Tải lại sơ đồ ghế</button></div>}<div className="cv-seat-legend"><span><i /> Còn trống</span><span><i className="selected"/> Đang chọn</span><span><i className="occupied"/> Đã đặt</span></div><div className="cv-selected-seats"><span>Ghế của bạn</span><strong>{seats.length ? seats.join(", ") : "Chưa chọn ghế"}</strong></div></>}
    {step === 2 && <><h3><Utensils size={19}/> Thêm một chút ngon</h3><p className="cv-booking-hint">Chọn combo yêu thích hoặc tiếp tục đến thanh toán.</p><div className="cv-booking-combos">{data.combos.map(combo => <article key={combo.id}><div className="cv-booking-combo-art">{combo.image ? <img src={combo.image} alt={combo.name}/> : <Utensils size={31}/>}</div><div className="cv-booking-combo-text"><h4>{combo.name}</h4><p>{combo.description}</p><strong>{money(combo.price)}</strong></div><div className="cv-quantity"><button disabled={!quantities[combo.id]} onClick={() => setQuantities(previous => ({ ...previous, [combo.id]: Math.max(0, (previous[combo.id] || 0) - 1) }))} aria-label={`Giảm ${combo.name}`}><Minus size={14}/></button><span>{quantities[combo.id] || 0}</span><button disabled={(quantities[combo.id] || 0) >= 5} onClick={() => setQuantities(previous => ({ ...previous, [combo.id]: (previous[combo.id] || 0) + 1 }))} aria-label={`Thêm ${combo.name}`}><Plus size={14}/></button></div></article>)}</div></>}
    {step === 3 && <><h3><CreditCard size={19}/> Hoàn tất cuộc hẹn</h3><div className="cv-payment-notice"><ShieldCheck size={21}/><div><strong>Thanh toán giả lập — không trừ tiền</strong><p>Đây là chức năng mô phỏng cho bài tập lớn. Không nhập thông tin thẻ hoặc chuyển khoản thật.</p></div></div><MembershipCheckout membership={membership} subtotal={subtotal} ticketPrice={show?.price || 0} promotionCode={promo?.code} value={{ ...memberBenefit, redeemPoints }} onChange={setMemberBenefit}/><label className="cv-field-label">Mã ưu đãi</label><div className="cv-promo-input"><input placeholder="Nhập mã ưu đãi" value={promoInput} onChange={event => { setPromoInput(event.target.value.toUpperCase()); setPromoError(""); }} aria-label="Mã ưu đãi"/><button onClick={applyPromo} disabled={!promoInput.trim()}>Áp dụng</button></div>{promoError && <p className="cv-field-error">{promoError}</p>}{promo && <p className="cv-field-success"><CheckCircle2 size={14}/> Đã áp dụng {promo.code}, giảm {promo.discountPercent}%. <button className="cv-text-link" onClick={() => { setPromoCode(""); setPromoInput(""); setPromoError(""); }}>Bỏ mã</button></p>}<label className="cv-field-label">Phương thức mô phỏng</label><div className="cv-payment-methods">{[{ id: "momo", label: "Ví MoMo", icon: "M", className: "momo" }, { id: "bank", label: "Chuyển khoản", icon: "B", className: "bank" }, { id: "card", label: "Thẻ ngân hàng", icon: "", className: "card" }].map(item => <button key={item.id} className={method === item.id ? "active" : ""} onClick={() => setMethod(item.id)}><span className={`cv-payment-icon ${item.className}`}>{item.icon || <CreditCard size={20}/>}</span><span>{item.label}<small>Giả lập</small></span><i>{method === item.id && <Check size={12}/>}</i></button>)}</div><p className="cv-booking-final-note">Sau khi xác nhận, vé sẽ được lưu vào tài khoản của bạn và ghế được giữ trong hệ thống.</p></>}
    {error && <div className="cv-error" role="alert">{error}</div>}<div className="cv-booking-controls">{step > 0 ? <button className="cv-btn cv-btn-outline" disabled={busy} onClick={() => { setStep(step - 1); setError(""); }}><ArrowLeft size={15}/> Quay lại</button> : <button className="cv-btn cv-btn-outline" onClick={onClose}>Hủy</button>}{step < 3 ? <button className="cv-btn cv-btn-primary" disabled={!show || (step === 1 && (!seats.length || seatsLoading || !!seatLoadError))} onClick={() => { setStep(step + 1); setError(""); }}>Tiếp tục<ArrowRight size={16}/></button> : <button className="cv-btn cv-btn-primary" disabled={busy || !seats.length} onClick={checkout}>{busy ? <><span className="cv-spinner-small"/> Đang xử lý...</> : <><ShieldCheck size={16}/> Xác nhận thanh toán</>}</button>}</div>
    </div><aside className="cv-booking-summary"><div className="cv-booking-film"><img src={movie.poster} alt={movie.title}/><div><span className="cv-age">{movie.ageRating}</span><h3>{movie.title}</h3><p>{movie.genres.slice(0, 2).join(" · ")}</p><small><Clock3 size={12}/> {movie.duration} phút</small></div></div><div className="cv-summary-show"><span>CINESTAR CINEMA</span><strong>{show ? dateTime(show.startTime) : "Chọn suất chiếu"}</strong><p>{room?.name || "—"}{show && ` · ${show.format}`}</p></div><dl className="cv-order-lines"><div><dt>Ghế ({seats.length})</dt><dd>{money(seatTotal)}</dd></div>{seats.length > 0 && <p className="cv-order-seat-label">{seats.join(", ")}</p>}<div><dt>Bắp & nước</dt><dd>{money(comboTotal)}</dd></div>{data.combos.filter(combo => quantities[combo.id]).map(combo => <p key={combo.id} className="cv-order-seat-label">{quantities[combo.id]} × {combo.name}</p>)}{discount > 0 && <div className="cv-order-discount"><dt>{promo ? `Ưu đãi ${promo.code}` : useBirthday ? "Ưu đãi sinh nhật" : rewardId ? "Vé thưởng thành viên" : `Dùng ${redeemPoints} điểm`}</dt><dd>−{money(discount)}</dd></div>}</dl><div className="cv-order-total"><span>Tổng thanh toán</span><strong>{money(total)}</strong></div><p className="cv-summary-note"><ShieldCheck size={14}/> Thanh toán giả lập. Không trừ tiền.</p></aside></div></>}</Modal>;
}
