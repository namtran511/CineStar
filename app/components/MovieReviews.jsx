"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, Film, MessageSquare, Send, Star, UserRound } from "lucide-react";
import "./reviews.css";

const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
    }).format(date);
};

async function requestReviews(url, options = {}) {
    const response = await fetch(url, {
        cache: "no-store",
        ...options,
        headers: { "Content-Type": "application/json", ...options.headers },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Không thể tải đánh giá. Vui lòng thử lại.");
    return data;
}

function RatingSummary({ rating, count }) {
    return <div className="cv-review-summary" aria-label={count ? `${Number(rating).toFixed(1)} trên 10 điểm, ${count} đánh giá` : "Chưa có đánh giá"}>
        <Star size={22} fill="currentColor" aria-hidden="true" />
        <div><strong>{count ? Number(rating).toFixed(1) : "—"}<small> / 10</small></strong><span>{count || 0} đánh giá từ khán giả</span></div>
    </div>;
}

function ReviewEntry({ review, own = false }) {
    return <article className={`cv-review-entry${own ? " cv-review-own" : ""}`}>
        <div className="cv-review-entry-heading">
            <span className="cv-review-avatar" aria-hidden="true">{(review.authorName || "K").slice(0, 1).toUpperCase()}</span>
            <div><strong>{own ? "Đánh giá của bạn" : review.authorName || "Khán giả CineStar"}</strong><span><CheckCircle2 size={12} aria-hidden="true" /> Đã xem tại rạp{review.createdAt && <> · <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time></>}</span></div>
            <span className="cv-review-score"><Star size={13} fill="currentColor" aria-hidden="true" />{review.rating}<small>/10</small></span>
        </div>
        <p className="cv-review-comment">{review.comment}</p>
    </article>;
}

function ReviewForm({ movieId, movieTitle, onSubmitted }) {
    const id = useId();
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [sent, setSent] = useState(false);
    const requestRef = useRef(null);
    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; requestRef.current?.abort(); };
    }, []);

    const submit = async (event) => {
        event.preventDefault();
        if (requestRef.current || sent) return;
        if (!rating || !comment.trim()) {
            setError("Hãy chọn điểm và viết cảm nhận của bạn trước khi gửi.");
            return;
        }
        const controller = new AbortController();
        requestRef.current = controller;
        setBusy(true);
        setError("");
        let result;
        try {
            result = await requestReviews(`/api/movies/${encodeURIComponent(movieId)}/reviews`, {
                method: "POST", signal: controller.signal,
                body: JSON.stringify({ rating, comment: comment.trim() }),
            });
        } catch (failure) {
            if (mounted.current && failure.name !== "AbortError") setError(failure.message);
        } finally {
            requestRef.current = null;
            if (mounted.current) setBusy(false);
        }
        if (result && mounted.current) {
            setSent(true);
            // A successful review stays successful even if a later catalog refresh fails.
            Promise.resolve().then(() => onSubmitted(result)).catch(() => {});
        }
    };

    if (sent) return <p className="cv-review-success" role="status"><CheckCircle2 size={17} /> Đã gửi đánh giá. Cảm ơn bạn đã chia sẻ!</p>;
    return <form className="cv-review-form" onSubmit={submit} aria-label={`Đánh giá phim ${movieTitle}`}>
        <div className="cv-review-form-heading"><MessageSquare size={18} aria-hidden="true" /><div><h3>Cảm nhận của bạn sau buổi chiếu</h3><p>Chia sẻ để khán giả tiếp theo chọn được bộ phim phù hợp.</p></div></div>
        <fieldset className="cv-review-rating-field" disabled={busy}>
            <legend>Bạn chấm phim bao nhiêu điểm? <span>(bắt buộc)</span></legend>
            <div className="cv-review-rating-options">{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <label className={rating === value ? "selected" : ""} key={value}>
                <input type="radio" name={`${id}-rating`} value={value} checked={rating === value} required onChange={() => setRating(value)} aria-label={`${value} trên 10 điểm`} />
                <span>{value}</span>
            </label>)}</div>
            <div className="cv-review-rating-scale"><span>Chưa phù hợp</span><span>Rất đáng xem</span></div>
        </fieldset>
        <label className="cv-review-comment-label" htmlFor={`${id}-comment`}>Cảm nhận về phim <span>(bắt buộc)</span></label>
        <textarea id={`${id}-comment`} value={comment} onChange={event => setComment(event.target.value)} maxLength={2000} required disabled={busy} rows={4} placeholder="Bạn thích điều gì ở bộ phim? Hãy hạn chế tiết lộ những tình tiết quan trọng nhé." aria-describedby={`${id}-count ${id}-note`} />
        <div className="cv-review-form-meta"><span id={`${id}-note`}>Mỗi phim được đánh giá một lần. Đánh giá đã gửi không thể sửa hoặc xóa.</span><span id={`${id}-count`}>{comment.length}/2000</span></div>
        {error && <p className="cv-review-error" role="alert">{error}</p>}
        <button className="cv-btn cv-btn-primary" type="submit" disabled={busy}><Send size={15} aria-hidden="true" />{busy ? "Đang gửi đánh giá..." : "Gửi đánh giá"}</button>
    </form>;
}

function MovieReviewsContent({ movie, user, onLogin, onRefresh, onReviewed, onRatingLoaded }) {
    const titleId = useId();
    const headingRef = useRef(null);
    const ratingCallbackRef = useRef(onRatingLoaded);
    ratingCallbackRef.current = onRatingLoaded;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [failedOffset, setFailedOffset] = useState(0);
    const [refreshError, setRefreshError] = useState("");
    const requestRef = useRef(null);
    const mounted = useRef(true);

    const load = async (offset = 0) => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setError("");
        if (offset) setLoadingMore(true); else setLoading(true);
        try {
            const result = await requestReviews(`/api/movies/${encodeURIComponent(movie.id)}/reviews?offset=${offset}`, { signal: controller.signal });
            if (controller.signal.aborted || !mounted.current) return;
            setData(previous => ({
                ...result,
                reviews: offset ? [...new Map([...(previous?.reviews || []), ...result.reviews].map(review => [review.id, review])).values()] : result.reviews,
            }));
            Promise.resolve().then(() => {
                if (mounted.current && !controller.signal.aborted) return ratingCallbackRef.current?.({ rating: result.rating, reviewCount: result.reviewCount });
            }).catch(() => {});
        } catch (failure) {
            if (!controller.signal.aborted && mounted.current) { setFailedOffset(offset); setError(failure.message); }
        } finally {
            if (requestRef.current === controller && mounted.current) {
                setLoading(false);
                setLoadingMore(false);
                requestRef.current = null;
            }
        }
    };

    useEffect(() => {
        mounted.current = true;
        load();
        return () => { mounted.current = false; requestRef.current?.abort(); };
    }, [movie.id, user?.id, user?.role]);

    useEffect(() => {
        if (success) headingRef.current?.focus({ preventScroll: true });
    }, [success]);

    const submitted = async (result) => {
        setSuccess(true);
        setData(previous => ({ ...previous, ownReview: result.review, canReview: false, rating: result.rating, reviewCount: result.reviewCount,
            total: result.reviewCount, reviews: [result.review, ...(previous?.reviews || []).filter(review => review.id !== result.review.id)],
        }));
        const outcomes = await Promise.allSettled([
            load(),
            Promise.resolve().then(() => onReviewed?.(result)),
            Promise.resolve().then(() => onRefresh?.()),
        ]);
        if (mounted.current && outcomes.some(outcome => outcome.status === "rejected")) setRefreshError("Đánh giá đã được lưu. Điểm ở một số khu vực sẽ cập nhật khi bạn tải lại trang.");
    };

    return <section className="cv-movie-reviews" aria-labelledby={titleId}>
        <div className="cv-reviews-heading"><div><span className="cv-section-kicker">GÓC NHÌN TỪ KHÁN GIẢ</span><h2 id={titleId} ref={headingRef} tabIndex={-1}>Đánh giá phim</h2><p>Những cảm nhận sau khi trực tiếp xem tại rạp.</p></div><RatingSummary rating={data?.rating ?? movie.rating} count={data?.reviewCount ?? movie.reviewCount} /></div>
        {success && <p className="cv-review-success" role="status"><CheckCircle2 size={17} /> Đánh giá của bạn đã được lưu và tính vào điểm chung của phim.</p>}
        {refreshError && <p className="cv-review-notice" role="status">{refreshError}</p>}
        {!user ? <div className="cv-review-callout"><UserRound size={22} aria-hidden="true" /><p>Đăng nhập để chia sẻ cảm nhận sau khi xem phim tại rạp.</p><button className="cv-btn cv-btn-outline" onClick={onLogin}>Đăng nhập</button></div>
            : data?.ownReview ? <div className="cv-review-own-wrap"><ReviewEntry review={data.ownReview} own /><p>Bạn đã đánh giá phim này. Mỗi khách hàng có một đánh giá cho mỗi phim.</p></div>
            : data?.canReview && user.role === "user" ? <ReviewForm movieId={movie.id} movieTitle={movie.title} onSubmitted={submitted} />
            : !loading && data ? <div className="cv-review-callout"><CheckCircle2 size={21} aria-hidden="true" /><p>{user.role === "user" ? "Bạn có thể đánh giá sau khi vé đã được soát tại rạp và suất chiếu kết thúc. Phim đủ điều kiện sẽ xuất hiện trong mục Đánh giá của tôi." : "Đánh giá được chia sẻ từ tài khoản khách hàng đã xem phim tại rạp."}</p></div> : null}
        {loading && !data && <p className="cv-review-loading" role="status">Đang tải đánh giá...</p>}
        {error && <div className="cv-review-error" role="alert"><span>{error}</span><button type="button" className="cv-text-link" onClick={() => load(failedOffset)}>Thử lại</button></div>}
        {data && <><div className="cv-review-list">{data.reviews.map(review => <ReviewEntry key={review.id} review={review} />)}</div>{!data.reviews.length && <div className="cv-review-empty"><MessageSquare size={27} aria-hidden="true" /><h3>Chưa có đánh giá cho phim này</h3><p>Cảm nhận của bạn có thể giúp người xem tiếp theo.</p></div>}{data.nextOffset !== null && data.nextOffset !== undefined && <button className="cv-btn cv-btn-outline cv-review-load-more" onClick={() => load(data.nextOffset)} disabled={loading || loadingMore}>{loadingMore ? "Đang tải..." : "Xem thêm đánh giá"}</button>}</>}
    </section>;
}

export default function MovieReviews(props) {
    return <MovieReviewsContent key={`${props.movie.id}:${props.user?.id || "guest"}:${props.user?.role || "guest"}`} {...props} />;
}

function MyReviewsContent({ user, onLogin, onExplore, onDetail, onRefresh }) {
    const id = useId();
    const [data, setData] = useState(null);
    const [tab, setTab] = useState("unreviewed");
    const [expanded, setExpanded] = useState(null);
    const [loading, setLoading] = useState(user?.role === "user");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [submittedCount, setSubmittedCount] = useState(0);
    const [refreshError, setRefreshError] = useState("");
    const requestRef = useRef(null);
    const mounted = useRef(true);
    const load = async () => {
        if (user?.role !== "user") return;
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setError("");
        try {
            const result = await requestReviews("/api/reviews/me", { signal: controller.signal });
            if (mounted.current && !controller.signal.aborted) setData(result);
        } catch (failure) {
            if (mounted.current && !controller.signal.aborted) setError(failure.message);
        } finally {
            if (mounted.current && requestRef.current === controller) {
                setLoading(false);
                requestRef.current = null;
            }
        }
    };
    useEffect(() => {
        mounted.current = true;
        load();
        return () => { mounted.current = false; requestRef.current?.abort(); };
    }, [user?.id, user?.role]);

    useEffect(() => {
        if (submittedCount) document.getElementById(`${id}-reviewed-tab`)?.focus({ preventScroll: true });
    }, [id, submittedCount]);

    const submitted = async (entry, result) => {
        setData(previous => ({
            reviewed: [{ ...entry, review: result.review, movie: { ...entry.movie, rating: result.rating, reviewCount: result.reviewCount } }, ...(previous?.reviewed || []).filter(item => item.movie.id !== entry.movie.id)],
            unreviewed: (previous?.unreviewed || []).filter(item => item.movie.id !== entry.movie.id),
        }));
        setExpanded(null);
        setTab("reviewed");
        setSubmittedCount(previous => previous + 1);
        setSuccess(`Đã lưu đánh giá cho “${entry.movie.title}”. Điểm của bạn đã được tính vào điểm chung của phim.`);
        const outcomes = await Promise.allSettled([load(), Promise.resolve().then(() => onRefresh?.())]);
        if (mounted.current && outcomes.some(outcome => outcome.status === "rejected")) setRefreshError("Đánh giá đã được lưu. Điểm ở một số khu vực sẽ cập nhật khi bạn tải lại trang.");
    };

    const entries = data?.[tab] || [];
    const selectTab = (next, focus = false) => {
        setTab(next);
        if (focus) document.getElementById(`${id}-${next}-tab`)?.focus();
    };
    const tabKeyDown = (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        selectTab(event.key === "Home" ? "unreviewed" : event.key === "End" ? "reviewed" : tab === "unreviewed" ? "reviewed" : "unreviewed", true);
    };

    return <main className="cv-container cv-inner-page cv-my-reviews">
        <div className="cv-page-heading"><div className="cv-section-kicker">SAU MỖI BUỔI CHIẾU, MỘT GÓC NHÌN</div><h1>Đánh giá của tôi</h1><p>Lưu lại cảm nhận về những bộ phim đã xem, giúp khán giả tiếp theo chọn phim dễ hơn.</p></div>
        {!user ? <div className="cv-empty"><MessageSquare size={40} /><h2>Đăng nhập để xem phim đã đánh giá</h2><p>Phim đã xem và những đánh giá của bạn được lưu cùng tài khoản.</p><button className="cv-btn cv-btn-primary" onClick={onLogin}><UserRound size={16} /> Đăng nhập</button></div>
            : user.role !== "user" ? <div className="cv-empty"><MessageSquare size={40} /><h2>Dành cho tài khoản khách hàng</h2><p>Bạn có thể đọc đánh giá của khán giả trong phần chi tiết phim.</p><button className="cv-btn cv-btn-primary" onClick={onExplore}>Khám phá phim<ArrowRight size={16} /></button></div>
            : <>
                <p className="cv-review-eligibility"><CheckCircle2 size={17} aria-hidden="true" /> Phim xuất hiện tại đây sau khi vé được soát tại rạp và suất chiếu kết thúc.</p>
                <div className="cv-review-tabs" role="tablist" aria-label="Phim và đánh giá của bạn" onKeyDown={tabKeyDown}>
                    {[{ key: "unreviewed", label: "Chưa đánh giá" }, { key: "reviewed", label: "Đã đánh giá" }].map(item => <button key={item.key} type="button" id={`${id}-${item.key}-tab`} role="tab" aria-selected={tab === item.key} aria-controls={`${id}-panel`} tabIndex={tab === item.key ? 0 : -1} className={tab === item.key ? "active" : ""} onClick={() => selectTab(item.key)}>{item.label}<span>{data?.[item.key]?.length ?? "—"}</span></button>)}
                </div>
                {success && <p className="cv-review-success" role="status"><CheckCircle2 size={18} />{success}</p>}
                {refreshError && <p className="cv-review-notice" role="status">{refreshError}</p>}
                {error && <div className="cv-review-error" role="alert"><span>{error}</span><button className="cv-text-link" onClick={load}>Thử lại</button></div>}
                <section id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}-tab`} tabIndex={0} className="cv-my-reviews-panel">
                    {loading && !data ? <div className="cv-empty" role="status"><div className="cv-spinner" /><p>Đang tải phim và đánh giá của bạn...</p></div>
                        : !data ? null
                        : !entries.length ? <div className="cv-review-empty cv-my-reviews-empty"><Film size={36} aria-hidden="true" /><h2>{tab === "reviewed" ? "Bạn chưa đánh giá phim nào" : "Chưa có phim chờ đánh giá"}</h2><p>{tab === "reviewed" ? "Sau buổi chiếu, chọn một phim trong mục Chưa đánh giá để chia sẻ cảm nhận." : data.reviewed.length ? "Bạn đã chia sẻ cảm nhận về tất cả phim đủ điều kiện. Hẹn bạn ở buổi chiếu tiếp theo!" : "Sau khi bạn xem phim tại rạp, những bộ phim đủ điều kiện sẽ xuất hiện ở đây."}</p><button className="cv-btn cv-btn-outline" onClick={onExplore}>Khám phá phim<ArrowRight size={16} /></button></div>
                        : <div className="cv-my-review-list">{entries.map(entry => <article className="cv-my-review-card" key={entry.movie.id}>
                            <button className="cv-my-review-poster" onClick={() => onDetail(entry.movie)} aria-label={`Xem chi tiết ${entry.movie.title}`}><img src={entry.movie.poster} alt={`Poster ${entry.movie.title}`} loading="lazy" /></button>
                            <div className="cv-my-review-info"><span className={`cv-my-review-badge ${entry.review ? "reviewed" : ""}`}><CheckCircle2 size={13} aria-hidden="true" />{entry.review ? "Đã chia sẻ cảm nhận" : "Sẵn sàng đánh giá"}</span><h2><button onClick={() => onDetail(entry.movie)}>{entry.movie.title}</button></h2><p className="cv-my-review-watched">Đã xem ngày <time dateTime={entry.watchedAt}>{formatDate(entry.watchedAt)}</time></p>
                                {entry.review ? <><div className="cv-my-review-result"><span className="cv-review-score"><Star size={14} fill="currentColor" />{entry.review.rating}<small>/10</small></span><span>Đánh giá ngày {formatDate(entry.review.createdAt)}</span></div><p className="cv-review-comment">{entry.review.comment}</p></>
                                    : <button className="cv-text-link cv-my-review-write" onClick={() => setExpanded(expanded === entry.movie.id ? null : entry.movie.id)} aria-expanded={expanded === entry.movie.id} aria-controls={`${id}-form-${entry.movie.id}`}><MessageSquare size={15} />{expanded === entry.movie.id ? "Thu gọn" : "Viết đánh giá"}<ArrowRight size={14} /></button>}
                            </div>
                            {!entry.review && <div className="cv-my-review-form-slot" id={`${id}-form-${entry.movie.id}`} hidden={expanded !== entry.movie.id}>{expanded === entry.movie.id && <ReviewForm movieId={entry.movie.id} movieTitle={entry.movie.title} onSubmitted={result => submitted(entry, result)} />}</div>}
                        </article>)}</div>}
                </section>
            </>}
    </main>;
}

export function MyReviews(props) {
    return <MyReviewsContent key={`${props.user?.id || "guest"}:${props.user?.role || "guest"}`} {...props} />;
}
