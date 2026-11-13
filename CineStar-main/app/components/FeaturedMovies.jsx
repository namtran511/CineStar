"use client";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, Pause, Play, Star, Ticket } from "lucide-react";
import { movieRatingLabel } from "@/lib/movie-rating";
import { featuredBackdrop, movieTrailer } from "@/lib/movie-media";
export default function FeaturedMovies({ movies, suspended, onBook, onDetail }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const [focused, setFocused] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(false);
    const current = movies.length ? index % movies.length : 0;
    const movie = movies[current];
    const rotating = movies.length > 1 && !paused && !focused && !hidden && !reducedMotion && !suspended;
    const trailer = movie && movieTrailer(movie);
    useEffect(() => {
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const syncMotion = () => setReducedMotion(preference.matches);
        const syncVisibility = () => setHidden(document.hidden);
        syncMotion();
        syncVisibility();
        preference.addEventListener("change", syncMotion);
        document.addEventListener("visibilitychange", syncVisibility);
        return () => {
            preference.removeEventListener("change", syncMotion);
            document.removeEventListener("visibilitychange", syncVisibility);
        };
    }, []);
    useEffect(() => {
        if (!rotating)
            return;
        const timer = window.setTimeout(() => setIndex((current + 1) % movies.length), 4000);
        return () => window.clearTimeout(timer);
    }, [current, movies.length, rotating]);
    const move = (step) => setIndex((current + step + movies.length) % movies.length);
    return <section className="cv-hero" aria-label="Phim nổi bật" aria-roledescription="trình chiếu" onPointerDown={() => setFocused(false)} onKeyDown={event => { if (event.key === "Tab")
        setFocused(true); }} onFocusCapture={event => { if (event.target.matches(":focus-visible"))
        setFocused(true); }} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget))
        setFocused(false); }}>
    <div className="cv-hero-backdrops" aria-hidden="true">
      {movies.map((item, slide) => <img key={item.id} className={`cv-hero-backdrop ${slide === current ? "active" : ""}`} src={featuredBackdrop(item)} alt="" decoding="async" onError={event => {
                const image = event.currentTarget;
                const fallback = image.dataset.posterFallback ? "/images/hero.jpg" : item.poster || "/images/hero.jpg";
                image.dataset.posterFallback = "true";
                if (image.src !== new URL(fallback, window.location.href).href)
                    image.src = fallback;
            }}/>)}
    </div>
    <div className="cv-hero-shade"/>
    <div className="cv-hero-content">
      <div className="cv-eyebrow"><span /> TRẢI NGHIỆM ĐIỆN ẢNH THEO CÁCH CỦA BẠN</div>
      <h1>Mỗi thước phim.<br />Một <span>thế giới mới.</span></h1>
      <p>Rời xa thường nhật. Bước vào những câu chuyện<br className="cv-desktop-break"/> khiến bạn không thể rời mắt.</p>
      {movie ? <div className="cv-hero-selection" aria-live={rotating ? "off" : "polite"} aria-atomic="true">
        <div className="cv-hero-feature"><span className="cv-now-pill">{movie.status === "now" ? "ĐANG CHIẾU" : "SẮP CHIẾU"}</span><button className="cv-hero-film" onClick={() => onDetail(movie)} aria-label={`Xem chi tiết ${movie.title}`}>{movie.title}</button></div>
        <div className="cv-hero-meta"><span><Star size={14} fill="currentColor"/> {movieRatingLabel(movie)}</span><i />{movie.genres.slice(0, 2).join(" / ")}<i /><span>{movie.duration} phút</span><span className="cv-hero-age">{movie.ageRating}</span></div>
        <div className="cv-hero-buttons">
          <button className="cv-btn cv-btn-primary" onClick={() => movie.status === "now" ? onBook(movie) : onDetail(movie)}><Ticket size={17}/>{movie.status === "now" ? "Đặt vé ngay" : "Khám phá phim"}<ArrowRight size={17}/></button>
          {trailer ? <a className="cv-btn cv-btn-glass" href={trailer} target="_blank" rel="noopener noreferrer" aria-label={`Xem trailer ${movie.title}`}><Play size={15} fill="currentColor"/> Xem trailer</a>
                : <button className="cv-btn cv-btn-glass" onClick={() => onDetail(movie)}>Xem chi tiết</button>}
        </div>
      </div> : <div className="cv-hero-feature">Phim nổi bật sẽ sớm được cập nhật.</div>}
      <div className="cv-hero-note"><span className="cv-hero-note-line"/> MÀN HÌNH LỚN. CẢM XÚC THẬT.</div>
    </div>
    <div className="cv-hero-side-label">CINEMA IS A FEELING</div>
    {movies.length > 0 && <div className="cv-hero-pagination">
      <em>PHIM NỔI BẬT</em><b>{String(current + 1).padStart(2, "0")} / {String(movies.length).padStart(2, "0")}</b>
      {movies.length > 1 && <>
        <button className="cv-hero-control" onClick={() => move(-1)} aria-label="Phim nổi bật trước"><ArrowLeft size={16}/></button>
        <button className="cv-hero-control" onClick={() => move(1)} aria-label="Phim nổi bật tiếp theo"><ArrowRight size={16}/></button>
        {!reducedMotion && <button className="cv-hero-control" onClick={() => setPaused(!paused)} aria-label={paused ? "Tiếp tục chuyển phim tự động" : "Tạm dừng chuyển phim tự động"}>{paused ? <Play size={14}/> : <Pause size={14}/>}</button>}
      </>}
    </div>}
    <button className="cv-scroll-hint" onClick={() => document.getElementById("movie-list")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth" })}>KHÁM PHÁ PHIM<ArrowDown size={14}/></button>
  </section>;
}
