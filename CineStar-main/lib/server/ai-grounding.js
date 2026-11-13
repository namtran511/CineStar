import { movieRatingLabel } from "../movie-rating.js";
const timeZone = "Asia/Ho_Chi_Minh";
const money = (value) => `${value.toLocaleString("vi-VN")}đ`;
const dateKey = (date) => new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
const showtimeReference = (show, catalog) => `s${catalog.showtimes.findIndex(item => item.id === show.id) + 1}`;
export class AiGroundingError extends Error {
}
export function matchingShowtimes(selection, catalog, now = Date.now()) {
    return catalog.showtimes.filter(show => {
        if (!Number.isFinite(Date.parse(show.startTime)) || Date.parse(show.startTime) < now + 10 * 60 * 1000)
            return false;
        if (selection.maxPrice !== null && show.price > selection.maxPrice)
            return false;
        if (selection.date && dateKey(new Date(show.startTime)) !== selection.date)
            return false;
        const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(new Date(show.startTime)));
        return selection.timeOfDay === "any" || (selection.timeOfDay === "morning" && hour < 12)
            || (selection.timeOfDay === "afternoon" && hour >= 12 && hour < 18) || (selection.timeOfDay === "evening" && hour >= 18);
    }).sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
}
// Resolve factual references on the server; the model writes its own advice and explanations.
export function materializeReply(reply, selection, catalog, now = Date.now(), customerContext = "") {
    if (!reply.trim() || reply.length > 8000)
        throw new AiGroundingError("Invalid Gemini reply");
    const prose = reply.replace(/\[\[[^\]\r\n]+\]\]/g, "");
    const customerNumbers = new Set();
    const units = { "không": 0, "một": 1, "mốt": 1, "hai": 2, "ba": 3, "bốn": 4, "tư": 4, "năm": 5, "lăm": 5, "sáu": 6, "bảy": 7, "tám": 8, "chín": 9 };
    const unitWords = Object.keys(units).join("|");
    const wordNumbers = new RegExp(`(?:^|\\s)((?:${unitWords}) mươi(?: (?:${unitWords}))?|mười(?: (?:${unitWords}))?|${unitWords})(?=\\s|[.,!?]|$)`, "gi");
    for (const match of customerContext.matchAll(wordNumbers)) {
        const words = match[1].toLowerCase().split(" ");
        const value = words[0] === "mười" ? 10 + (units[words[1]] || 0)
            : words[1] === "mươi" ? units[words[0]] * 10 + (units[words[2]] || 0) : units[words[0]];
        customerNumbers.add(String(value));
    }
    for (const match of customerContext.matchAll(/\d[\d.,]*(?:\s*(?:k|nghìn|ngàn))?/gi)) {
        const amount = Number(match[0].match(/[\d.,]+/)[0].replace(/[.,]/g, ""));
        customerNumbers.add(String(amount));
        if (/(?:k|nghìn|ngàn)/i.test(match[0]))
            customerNumbers.add(String(amount * 1000));
    }
    const normalized = prose.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
    if (/khong (?:he )?co (?:bat ky |mot |canh nao |canh |chi tiet |yeu to )*(?:dang so|gay so hai|kinh di|giat minh|jump ?scare|bao luc)/.test(normalized)) {
        throw new AiGroundingError("Unsupported scene-content guarantee; give a cautious recommendation based on synopsis and genres");
    }
    const showtimes = matchingShowtimes(selection, catalog, now);
    const requiresScreening = selection.intent === "schedule" || selection.intent === "prices"
        || selection.maxPrice !== null || Boolean(selection.date) || selection.timeOfDay !== "any";
    const eligibleMovies = catalog.movies.filter(movie => (selection.status === "any" || movie.status === selection.status)
        && (!selection.children || ["P", "G", "K"].includes(movie.ageRating.toUpperCase()))
        && (!selection.genres.length || selection.genres.some(genre => movie.genres.includes(genre)))
        && (!requiresScreening || showtimes.some(show => show.movieId === movie.id)));
    const movies = eligibleMovies.filter(movie => selection.movieIds.includes(movie.id));
    if (movies.length !== new Set(selection.movieIds).size) {
        throw new AiGroundingError(`Gemini recommendation violates catalog constraints. Eligible movie IDs for your selected filters: ${eligibleMovies.map(movie => movie.id).join(", ") || "none"}. If none fit the user's constraints, use empty movieIds and explain the limitation; do not silently change the requested day or budget.`);
    }
    if (selection.intent === "out_of_scope" && selection.movieIds.length)
        throw new AiGroundingError("Invalid out-of-scope recommendation");
    let referenceCount = 0;
    const referencedMovies = new Set();
    const renderedFacts = [];
    const fact = (value) => { renderedFacts.push(value); return value; };
    const withPrices = reply.replace(/\[\[ticketPrices\]\]/g, () => {
        if (selection.intent === "out_of_scope")
            throw new AiGroundingError("Out-of-scope reply contains catalog references");
        const prices = catalog.showtimes.filter(show => Date.parse(show.startTime) >= now + 10 * 60 * 1000).map(show => show.price);
        return fact(prices.length ? `giá vé các suất còn đặt được từ ${money(Math.min(...prices))} đến ${money(Math.max(...prices))}` : "hiện chưa có suất chiếu còn đặt được để báo giá vé");
    });
    const message = withPrices.replace(/\[\[(movie|movieInfo|showtime|promotion|combo):([^\]\r\n]+)\]\]/g, (_, type, id) => {
        referenceCount++;
        if (selection.intent === "out_of_scope")
            throw new AiGroundingError("Out-of-scope reply contains catalog references");
        if (type === "movie" || type === "movieInfo") {
            const movie = catalog.movies.find(item => item.id === id);
            if (!movie)
                throw new AiGroundingError("Unknown movie reference");
            referencedMovies.add(movie.id);
            if (type === "movie")
                return fact(movie.title);
            return fact(`${movie.title} · ${movie.genres.join(", ")} · ${movie.duration} phút · ${movie.ageRating} · ${movieRatingLabel(movie)}${movie.reviewCount > 0 ? ` (${movie.reviewCount} đánh giá từ khách đã xem)` : ""}\n${movie.description}\nĐạo diễn: ${movie.director}. Diễn viên: ${movie.cast.join(", ")}.${movie.status === "coming" ? `\nSắp chiếu · dự kiến ra mắt: ${movie.releaseDate}.` : "\nĐang chiếu."}`);
        }
        if (type === "showtime") {
            const eligibleShows = showtimes.filter(item => movies.some(movie => movie.id === item.movieId));
            const show = eligibleShows.find(item => item.id === id || showtimeReference(item, catalog) === id);
            if (!show)
                throw new AiGroundingError(`Unknown or ineligible showtime reference. Use only these showtime references for your selected movies and filters: ${eligibleShows.map(item => showtimeReference(item, catalog)).join(", ") || "none"}.`);
            const movie = movies.find(item => item.id === show.movieId);
            referencedMovies.add(movie.id);
            const room = catalog.rooms.find(item => item.id === show.roomId);
            const time = new Intl.DateTimeFormat("vi-VN", { timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(show.startTime));
            return fact(`${movie.title} — ${time} · ${room?.name || "Phòng chiếu"} · ${show.format} · ${money(show.price)}`);
        }
        if (type === "promotion") {
            const promo = catalog.promotions.find(item => item.active && item.code === id);
            if (!promo)
                throw new AiGroundingError("Unknown or inactive promotion reference");
            return fact(`mã ${promo.code} (giảm ${promo.discountPercent}% cho đơn từ ${money(promo.minTotal)})`);
        }
        const combo = catalog.combos.find(item => item.id === id);
        if (!combo)
            throw new AiGroundingError("Unknown combo reference");
        return fact(`${combo.name} (${combo.description}; ${money(combo.price)})`);
    });
    if (/\[\[|\]\]/.test(message) || (selection.movieIds.length > 0 && referenceCount === 0)
        || selection.movieIds.some(id => !referencedMovies.has(id)))
        throw new AiGroundingError("Unresolved or missing catalog references");
    const approvedNumbers = new Set([...customerNumbers, ...renderedFacts.flatMap(value => [...value.matchAll(/\d[\d.,]*/g)].map(match => String(Number(match[0].replace(/[.,]/g, "")))))]);
    const unsupportedNumbers = [...prose.matchAll(/\d[\d.,]*(?:\s*(?:k|nghìn|ngàn))?/gi)].map(match => {
        const amount = Number(match[0].match(/[\d.,]+/)[0].replace(/[.,]/g, ""));
        return { token: match[0], value: String(amount * (/(?:k|nghìn|ngàn)/i.test(match[0]) ? 1000 : 1)) };
    }).filter(({ value }) => !approvedNumbers.has(value));
    if (unsupportedNumbers.length) {
        throw new AiGroundingError(`Numeric catalog facts must first appear in verified references such as [[ticketPrices]]. Customer-provided numbers and repetitions of referenced facts are allowed. Add references or remove unsupported facts for these tokens: ${[...new Set(unsupportedNumbers.map(item => item.token))].join(", ")}.`);
    }
    return message.trim();
}
export function publicCatalogSnapshot(catalog, now = Date.now()) {
    return {
        movies: catalog.movies.map(({ id, title, originalTitle, genres, description, director, cast, ageRating, status, duration, rating, reviewCount, releaseDate }) => ({ id, title, originalTitle, genres, description, director, cast, ageRating, status, duration, rating, reviewCount: reviewCount || 0, releaseDate })),
        showtimes: catalog.showtimes.filter(show => Date.parse(show.startTime) >= now + 10 * 60 * 1000).map(show => ({
            ...show,
            referenceId: showtimeReference(show, catalog),
            vietnamDate: dateKey(new Date(show.startTime)),
            vietnamTime: new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(show.startTime)),
        })),
        rooms: catalog.rooms.map(({ id, name, type }) => ({ id, name, type })),
        combos: catalog.combos.map(({ id, name, description, price }) => ({ id, name, description, price })),
        promotions: catalog.promotions.filter(promo => promo.active).map(({ code, discountPercent, minTotal }) => ({ code, discountPercent, minTotal })),
    };
}
