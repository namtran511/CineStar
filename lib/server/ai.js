import { AiGroundingError, matchingShowtimes, materializeReply, publicCatalogSnapshot } from "./ai-grounding";
import { cineverseAssistantInstruction, cineverseWebsiteGuide } from "./ai-prompt";
import { getCatalog } from "./catalog";
import { getEnv } from "./db";
import { movieRatingLabel } from "../movie-rating.js";
const intents = ["recommend", "details", "schedule", "prices", "promotions", "combos", "conversation", "website", "out_of_scope"];
const timeZone = "Asia/Ho_Chi_Minh";
const money = (value) => `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
const normalize = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const includes = (value, choices) => choices.some((choice) => value.includes(choice));
const refusal = "Mình chỉ hỗ trợ thông tin có trong dữ liệu công khai của CineStar: phim, lịch chiếu, giá vé, combo và ưu đãi. Hãy thử: “Gợi ý phim hành động tối nay dưới 100k”.";
class GeminiTransientError extends Error {
}
// This snapshot contains only public catalog data, never users, orders or credentials.
// Gemini interprets the conversation and writes natural advice; factual references are resolved from D1.
export async function answerCatalogQuestion(message, history = []) {
    const catalog = await getCatalog();
    const local = demoSelection(message, catalog);
    const env = await getEnv();
    const key = env.GEMINI_API_KEY?.trim();
    let prefix = "[Demo · gợi ý từ dữ liệu rạp] ";
    if (key) {
        try {
            let correction;
            const deadline = Date.now() + 45_000;
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const result = await geminiReply(message, history, catalog, key, env.GEMINI_MODEL || "gemini-2.5-flash", correction, Math.min(30_000, deadline - Date.now()));
                    return {
                        message: materializeReply(result.reply, result.selection, catalog, Date.now(), [...history.filter(turn => turn.role === "user").map(turn => turn.text), message].join("\n")),
                        movieIds: result.selection.movieIds,
                        mode: "gemini",
                        scope: result.selection.intent === "out_of_scope" ? "out_of_scope" : "catalog",
                    };
                }
                catch (error) {
                    if (attempt === 1)
                        throw error;
                    if (error instanceof AiGroundingError)
                        correction = error.message;
                    else if (error instanceof GeminiTransientError)
                        await new Promise(resolve => setTimeout(resolve, 500));
                    else
                        throw error;
                }
            }
        }
        catch (error) {
            // Never expose upstream errors, credentials, prompts or unvalidated model output.
            const reason = error instanceof AiGroundingError ? error.message : error instanceof Error && /^(Invalid Gemini|Incomplete Gemini|Gemini unavailable)/.test(error.message) ? error.message
                : error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "Gemini request timed out"
                    : error instanceof Error && ["TypeError", "SyntaxError"].includes(error.name) ? `Gemini request failed (${error.name})` : "Gemini request failed";
            console.warn("CineStar AI fallback:", reason);
            prefix = "[Demo · Gemini tạm không khả dụng] ";
        }
    }
    if (local.intent === "out_of_scope") {
        return { message: refusal, movieIds: [], mode: "demo", scope: "out_of_scope" };
    }
    const answer = renderAnswer(local, catalog);
    return { message: prefix + answer.message, movieIds: answer.movieIds, mode: "demo", scope: "catalog" };
}
function dateInVietnam(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    return ["year", "month", "day"].map((part) => parts.find((p) => p.type === part)?.value).join("-");
}
function explicitDate(text) {
    if (text.includes("hom nay") || text.includes("toi nay") || text.includes("today") || text.includes("tonight"))
        return dateInVietnam();
    if (text.includes("ngay mai") || text.includes("tomorrow"))
        return dateInVietnam(new Date(Date.now() + 86_400_000));
    const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (iso && validDate(iso[1]))
        return iso[1];
    const short = text.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?\b/);
    if (short) {
        const result = `${short[3] || dateInVietnam().slice(0, 4)}-${short[2].padStart(2, "0")}-${short[1].padStart(2, "0")}`;
        if (validDate(result))
            return result;
    }
    return "";
}
function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function budget(text) {
    const found = text.match(/(?:duoi|toi da|khong qua|ngan sach|under|less than|max(?:imum)?)\s*(\d[\d.,]*)\s*(k|nghin|ngan|vnd|d|dong)?/);
    if (!found)
        return null;
    const amount = Number(found[1].replace(/[.,]/g, "")) * (includes(found[2] || "", ["k", "nghin", "ngan"]) ? 1000 : 1);
    return Number.isFinite(amount) && amount >= 0 && amount <= 100_000_000 ? amount : null;
}
function mentionsMovie(text, title) {
    const name = normalize(title);
    if (name === "mai")
        return /\bmai\b/.test(text.replace(/\bngay mai\b/g, ""));
    const words = name.match(/[a-z0-9]+/g) || [];
    if (text.includes(name))
        return true;
    const prefix = words.slice(0, 2).join(" ");
    if (words.length > 2 && prefix.length >= 7 && text.includes(prefix))
        return true;
    const lead = words[0] === "the" ? words[1] : words[0];
    return Boolean(lead && lead.length >= 4 && !["nhung", "nguoi", "hanh"].includes(lead) && new RegExp(`\\b${lead}\\b`).test(text));
}
function demoSelection(message, catalog) {
    const text = normalize(message);
    const genres = [...new Set(catalog.movies.flatMap((movie) => movie.genres))].filter((genre) => text.includes(normalize(genre)));
    const movieIds = catalog.movies.filter((movie) => {
        return [movie.title, movie.originalTitle].filter(Boolean).some((title) => mentionsMovie(text, title));
    }).map((movie) => movie.id);
    const knownPerson = catalog.movies.some((movie) => [movie.director, ...movie.cast].filter(Boolean).some((name) => text.includes(normalize(name))));
    const privateOrUnsafe = /\b(sql|insert into|delete from|drop table|truncate|password|secret|token|credential|system prompt|api key|api_key)\b/.test(text)
        || includes(text, ["mat khau", "khoa api", "bo qua huong dan", "bo qua quy tac", "ignore previous", "ignore all", "khach hang", "tai khoan", "don hang cua", "ve cua toi", "email", "so dien thoai", "doanh thu", "du lieu ca nhan", "lap trinh", "viet code", "chung khoan", "thoi tiet", "chinh tri", "thuoc", "toan hoc"]);
    const domain = /\b(phim|rap|ve|cinema|movie|film|showtime|ticket|combo|popcorn)\b/.test(text)
        || includes(text, ["lich chieu", "suat chieu", "goi y", "recommend", "uu dai", "khuyen mai", "bap", "nuoc", "tre em", "gia dinh", "hoat hinh", "hanh dong", "kinh di"])
        || genres.length > 0 || movieIds.length > 0 || knownPerson;
    let intent = "recommend";
    if (includes(text, ["uu dai", "khuyen mai", "giam gia", "ma giam", "promotion", "discount"]))
        intent = "promotions";
    else if (includes(text, ["combo", "bap", "popcorn", "do uong", "nuoc ngot"]))
        intent = "combos";
    else if (includes(text, ["lich chieu", "suat chieu", "may gio", "chieu luc", "showtime", "schedule"]))
        intent = "schedule";
    else if (includes(text, ["gia ve", "bao nhieu tien", "ticket price", "gia bao nhieu"]))
        intent = "prices";
    else if (includes(text, ["noi dung", "dao dien", "dien vien", "thoi luong", "thong tin", "chi tiet", "plot", "director", "cast"]))
        intent = "details";
    if (privateOrUnsafe || !domain)
        intent = "out_of_scope";
    const children = includes(text, ["tre em", "cho be", "con nho", "ca nha", "gia dinh", "children", "kids", "family"]);
    const timeOfDay = includes(text, ["buoi toi", "toi nay", "sau 18", "evening", "tonight"]) ? "evening"
        : includes(text, ["buoi sang", "morning"]) ? "morning" : includes(text, ["buoi chieu", "afternoon"]) ? "afternoon" : "any";
    const status = includes(text, ["sap chieu", "coming soon", "upcoming"]) ? "coming" : intent === "details" ? "any" : "now";
    const matchedPeople = knownPerson ? catalog.movies.filter((movie) => [movie.director, ...movie.cast].some((name) => name && text.includes(normalize(name)))).map((movie) => movie.id) : [];
    const unknownQuotedTitle = /[“"']([^“”"']+)[”"']/.test(message) && movieIds.length === 0;
    const selectedIds = movieIds.length ? movieIds : knownPerson ? matchedPeople : intent === "details" || unknownQuotedTitle ? [] : catalog.movies.map((movie) => movie.id);
    return { intent, movieIds: selectedIds, genres, children, maxPrice: budget(text), date: explicitDate(text), timeOfDay, status };
}
async function geminiReply(message, history, catalog, key, model, correction, timeoutMs = 30_000) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(model))
        throw new Error("Invalid Gemini model setting");
    const genres = [...new Set(catalog.movies.flatMap((movie) => movie.genres))];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(Math.max(1, timeoutMs)),
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: cineverseAssistantInstruction + (correction ? `\nSERVER VALIDATION CORRECTION: Your previous draft was rejected: ${correction}. Resolve this in the new JSON reply, preserving the user's request and the catalog constraints.` : "") }] },
            contents: [{ role: "user", parts: [{ text: JSON.stringify({
                                vietnamDate: dateInVietnam(),
                                tomorrowDate: dateInVietnam(new Date(Date.now() + 86_400_000)),
                                vietnamTime: new Date().toLocaleString("vi-VN", { timeZone }),
                                catalog: publicCatalogSnapshot(catalog),
                                websiteGuide: cineverseWebsiteGuide,
                                history: history.map(turn => ({ role: turn.role, text: turn.text, movieIds: turn.movieIds?.filter(id => catalog.movies.some(movie => movie.id === id)) })),
                                customerQuery: message,
                            }) }] }],
            generationConfig: {
                temperature: 0.55,
                maxOutputTokens: 4096,
                ...(model.startsWith("gemini-2.5") ? { thinkingConfig: { thinkingBudget: 1024 } }
                    : model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "high" } } : {}),
                responseMimeType: "application/json",
                responseJsonSchema: {
                    type: "object",
                    properties: {
                        reply: { type: "string", description: "Natural Vietnamese advice with verified catalog reference placeholders." },
                        selection: {
                            type: "object",
                            properties: {
                                intent: { type: "string", enum: intents },
                                movieIds: { type: "array", maxItems: 4, items: { type: "string", ...(catalog.movies.length ? { enum: catalog.movies.map((movie) => movie.id) } : {}) } },
                                genres: { type: "array", maxItems: 4, items: { type: "string", ...(genres.length ? { enum: genres } : {}) } },
                                children: { type: "boolean" },
                                maxPrice: { type: ["number", "null"], minimum: 0, maximum: 100_000_000 },
                                date: { type: "string", description: "YYYY-MM-DD or empty string" },
                                timeOfDay: { type: "string", enum: ["any", "morning", "afternoon", "evening"] },
                                status: { type: "string", enum: ["any", "now", "coming"] },
                            },
                            required: ["intent", "movieIds", "genres", "children", "maxPrice", "date", "timeOfDay", "status"],
                            additionalProperties: false,
                        },
                    },
                    required: ["reply", "selection"],
                    additionalProperties: false,
                },
            },
        }),
    });
    if (!response.ok) {
        if (response.status === 429) {
            const failure = await response.json();
            const details = failure.error?.details || [];
            console.warn("CineStar Gemini quota:", JSON.stringify({
                limits: details.flatMap(detail => (detail.violations || []).map(({ quotaMetric, quotaValue }) => ({ quotaMetric, quotaValue }))),
                retryDelay: details.find(detail => detail.retryDelay)?.retryDelay,
            }));
        }
        if ([502, 503, 504].includes(response.status))
            throw new GeminiTransientError(`Gemini unavailable (${response.status})`);
        throw new Error(`Gemini unavailable (${response.status})`);
    }
    const payload = await response.json();
    const candidate = payload.candidates?.[0];
    if (candidate?.finishReason !== "STOP")
        throw new Error("Incomplete Gemini selection");
    const raw = candidate.content?.parts?.filter(part => !part.thought).map((part) => part.text || "").join("") || "";
    if (raw.length > 16_000)
        throw new Error("Invalid Gemini reply");
    const result = JSON.parse(raw);
    if (!result || typeof result !== "object" || Array.isArray(result))
        throw new Error("Invalid Gemini reply");
    const answer = result;
    if (typeof answer.reply !== "string" || !validSelection(answer.selection, catalog))
        throw new Error("Invalid Gemini reply");
    return { selection: answer.selection, reply: answer.reply };
}
function validSelection(value, catalog) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const selection = value;
    const movieIds = new Set(catalog.movies.map((movie) => movie.id));
    const genres = new Set(catalog.movies.flatMap((movie) => movie.genres));
    return Object.keys(selection).length === 8
        && intents.includes(selection.intent)
        && Array.isArray(selection.movieIds) && selection.movieIds.length <= 4 && selection.movieIds.every((id) => typeof id === "string" && movieIds.has(id))
        && new Set(selection.movieIds).size === selection.movieIds.length
        && Array.isArray(selection.genres) && selection.genres.length <= 4 && selection.genres.every((genre) => typeof genre === "string" && genres.has(genre))
        && typeof selection.children === "boolean"
        && (selection.maxPrice === null || (typeof selection.maxPrice === "number" && Number.isFinite(selection.maxPrice) && selection.maxPrice >= 0 && selection.maxPrice <= 100_000_000))
        && typeof selection.date === "string" && (selection.date === "" || validDate(selection.date))
        && ["any", "morning", "afternoon", "evening"].includes(selection.timeOfDay)
        && ["any", "now", "coming"].includes(selection.status);
}
function renderAnswer(selection, catalog) {
    if (selection.intent === "promotions") {
        const promotions = catalog.promotions.filter((promotion) => promotion.active);
        return { movieIds: [], message: promotions.length ? "Ưu đãi trong dữ liệu rạp:\n" + promotions.map((promotion) => promotionSummary(promotion)).join("\n") : "Dữ liệu rạp hiện chưa có ưu đãi." };
    }
    if (selection.intent === "combos") {
        return { movieIds: [], message: catalog.combos.length ? "Combo tại rạp:\n" + catalog.combos.map((combo) => comboSummary(combo)).join("\n") : "Dữ liệu rạp hiện chưa có combo." };
    }
    const showtimes = matchingShowtimes(selection, catalog);
    const needsShowtime = selection.intent === "schedule" || selection.intent === "prices" || selection.maxPrice !== null || Boolean(selection.date) || selection.timeOfDay !== "any";
    let movies = catalog.movies.filter((movie) => {
        if (!selection.movieIds.includes(movie.id))
            return false;
        if (selection.status !== "any" && movie.status !== selection.status)
            return false;
        if (selection.genres.length && !selection.genres.some((genre) => movie.genres.includes(genre)))
            return false;
        if (selection.children && !["P", "G", "K"].includes(movie.ageRating.toUpperCase()))
            return false;
        if (needsShowtime && !showtimes.some((showtime) => showtime.movieId === movie.id))
            return false;
        return true;
    });
    if (selection.intent === "details" && !selection.movieIds.length)
        movies = [];
    if (selection.intent === "recommend")
        movies.sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));
    movies = movies.slice(0, 4);
    if (!movies.length)
        return { message: "Mình chưa tìm thấy phim hoặc suất chiếu phù hợp trong dữ liệu rạp. Bạn thử đổi thể loại, ngày chiếu hoặc ngân sách nhé.", movieIds: [] };
    const lines = movies.map((movie) => {
        const movieShowtimes = showtimes.filter((showtime) => showtime.movieId === movie.id);
        const summary = `${movie.title} · ${movie.genres.join(", ")} · ${movie.duration} phút · ${movie.ageRating} · ${movieRatingLabel(movie)}`;
        if (selection.intent === "details")
            return `${summary}\n${movie.description}\nĐạo diễn: ${movie.director}. Diễn viên: ${movie.cast.join(", ")}.`;
        if (selection.intent === "schedule")
            return `${movie.title}\n${movieShowtimes.slice(0, 5).map((showtime) => showtimeSummary(showtime, catalog)).join("\n")}`;
        if (selection.intent === "prices") {
            const prices = movieShowtimes.map((showtime) => showtime.price);
            return `${movie.title}: ${money(Math.min(...prices))}${Math.max(...prices) !== Math.min(...prices) ? ` – ${money(Math.max(...prices))}` : ""} tùy suất chiếu.\n${movieShowtimes.slice(0, 2).map((showtime) => showtimeSummary(showtime, catalog)).join("\n")}`;
        }
        const next = movieShowtimes[0];
        return `${summary}${next ? `\nSuất phù hợp gần nhất: ${showtimeSummary(next, catalog)}` : movie.status === "coming" ? `\nDự kiến ra mắt: ${movie.releaseDate}.` : "\nChưa có suất chiếu sắp tới trong dữ liệu."}`;
    });
    const heading = selection.intent === "recommend" ? "Dựa trên dữ liệu hiện có, mình gợi ý:\n" : "Thông tin từ dữ liệu rạp:\n";
    const note = selection.children ? "\nCác phim trên có nhãn P hoặc K; vui lòng kiểm tra phân loại tuổi trước khi đặt vé." : "";
    return { message: heading + lines.join("\n\n") + note, movieIds: movies.map((movie) => movie.id) };
}
function showtimeSummary(showtime, catalog) {
    const time = new Intl.DateTimeFormat("vi-VN", { timeZone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(showtime.startTime));
    const room = catalog.rooms.find((item) => item.id === showtime.roomId);
    return `${time} · ${room?.name || "Phòng chiếu"} · ${showtime.format} · ${money(showtime.price)}`;
}
function promotionSummary(promotion) {
    return `Mã ${promotion.code} · giảm ${promotion.discountPercent}% · đơn tối thiểu ${money(promotion.minTotal)}`;
}
function comboSummary(combo) {
    return `${combo.name} · ${money(combo.price)} · ${combo.description}`;
}
