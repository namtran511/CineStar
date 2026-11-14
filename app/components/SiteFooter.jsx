"use client";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Film, Headphones, Mail, MapPin, Navigation, Phone, ShieldCheck, Sparkles, Ticket } from "lucide-react";
import CinemaMap from "./CinemaMap";
import "./footer.css";

function FacebookIcon({ size = 16 }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>;
}

export default function SiteFooter({ navigate, openAi, cinema }) {
    const name = cinema?.name || "CineStar";
    const destination = cinema?.center?.length === 2 ? `${cinema.center[1]},${cinema.center[0]}` : cinema?.address;
    const contacts = [
        { label: "Email liên hệ", value: cinema?.email, href: cinema?.email ? `mailto:${cinema.email}` : null, Icon: Mail },
        { label: "Facebook", value: cinema?.facebookUrl ? "Ghé thăm trang Facebook" : null, href: cinema?.facebookUrl, Icon: FacebookIcon, external: true },
        { label: "Điện thoại hỗ trợ", value: cinema?.phone, href: cinema?.phone ? `tel:${cinema.phone.replace(/[^+\d]/g, "")}` : null, Icon: Phone },
    ];
    return <footer className="cv-footer">
        <div className="cv-container">
            <div className="cv-footer-invitation"><div><span className="cv-section-kicker">SEE YOU AT THE MOVIES</span><h2>Một bộ phim hay.<br className="cv-footer-mobile-break"/> Một cuộc hẹn đáng nhớ.</h2></div><button onClick={() => navigate("schedule")} className="cv-footer-book"><Ticket size={16}/> Lên lịch đi xem phim<ArrowUpRight size={17}/></button></div>
            <div className="cv-footer-grid">
                <div className="cv-footer-brand">
                    <button className="cv-logo" aria-label="Trang chủ CineStar" onClick={() => navigate("movies")}><span className="cv-logo-icon"><Film size={25}/></span>Cine<span>Star</span><span className="cv-logo-dot">.</span></button>
                    <p>Nơi những câu chuyện trở thành trải nghiệm. Chọn phim bạn thích, giữ chỗ bạn yêu và tận hưởng màn ảnh lớn.</p>
                    <button className="cv-footer-ai" onClick={openAi} aria-haspopup="dialog"><span className="cv-footer-ai-icon"><Sparkles size={20}/></span><span><strong>Chưa biết xem gì?</strong><small>Để AI tìm phim đúng gu bạn</small></span><ArrowRight size={16}/></button>
                </div>
                <nav className="cv-footer-nav" aria-label="Khám phá CineStar"><h3>Khám phá</h3><button onClick={() => navigate("movies")}>Phim tại CineStar</button><button onClick={() => navigate("schedule")}>Lịch chiếu</button><button onClick={() => navigate("promotions")}>Ưu đãi & combo</button><button onClick={() => navigate("tickets")}>Vé của tôi</button><button onClick={openAi} aria-haspopup="dialog">Trợ lý AI <Sparkles size={12}/></button><div className="cv-footer-note"><CalendarDays size={17}/><span>Chọn suất chiếu phù hợp<br/>với lịch hẹn của bạn.</span></div></nav>
                <section className="cv-footer-contact" aria-labelledby="footer-contact-heading">
                    <h3 id="footer-contact-heading">Liên hệ & hỗ trợ</h3>
                    <div className="cv-footer-contact-list">{contacts.map(({ label, value, href, Icon, external }) => {
                        const content = <><span className="cv-footer-contact-icon"><Icon size={16}/></span><span><strong>{label}</strong><small>{value || "Đang cập nhật"}</small></span>{href && <ArrowUpRight className="cv-footer-contact-arrow" size={13}/> }</>;
                        return href ? <a key={label} className="cv-footer-contact-item" href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} aria-label={`${label}: ${value}${external ? " (mở tab mới)" : ""}`}>{content}</a> : <div key={label} className="cv-footer-contact-item cv-footer-contact-pending">{content}</div>;
                    })}</div>
                    <details className="cv-footer-help"><summary><Headphones size={15}/><span>Hướng dẫn & hỗ trợ</span><ChevronDown size={13}/></summary><div className="cv-footer-help-content"><p>Đặt vé chỉ với vài bước:</p><ol><li>Chọn phim và suất chiếu, sau đó đăng nhập.</li><li>Chọn ghế, thêm combo hoặc mã ưu đãi nếu có.</li><li>Hoàn tất thanh toán và xem vé tại <strong>Vé của tôi</strong>.</li></ol><button onClick={() => navigate("tickets")}><Ticket size={13}/> Tra cứu vé đã đặt<ArrowRight size={13}/></button><button onClick={openAi} aria-haspopup="dialog"><Sparkles size={13}/> Hỏi trợ lý AI<ArrowRight size={13}/></button></div></details>
                </section>
                <section className="cv-footer-location" aria-labelledby="cinema-location-heading">
                    <div className="cv-footer-location-heading"><h3 id="cinema-location-heading"><MapPin size={16}/> Ghé thăm rạp</h3><span>CINESTAR CINEMA</span></div>
                    <div className="cv-footer-map-card"><CinemaMap cinema={cinema}/><div className="cv-footer-address"><div><strong>{name}</strong><p>{cinema?.address || "Địa chỉ rạp đang được cập nhật."}</p></div>{destination && <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`} target="_blank" rel="noopener noreferrer" aria-label={`Chỉ đường đến ${name} (mở tab mới)`}><Navigation size={14}/> Chỉ đường</a>}</div></div>
                </section>
            </div>
            <nav className="cv-footer-policies" aria-label="Chính sách CineStar"><a href="/policies#terms">Điều khoản sử dụng</a><a href="/policies#privacy">Chính sách bảo mật</a><a href="/policies#payment">Thanh toán &amp; hoàn hủy vé</a><a href="/policies#cinema-rules">Nội quy rạp phim</a><a href="/policies/notifications">Thông báo qua email</a></nav>
            <div className="cv-footer-bottom"><span>© {new Date().getFullYear()} CineStar. Dự án quản lý rạp chiếu phim.</span><span><ShieldCheck size={13}/> Thanh toán VietQR qua SePay</span></div>
        </div>
    </footer>;
}
