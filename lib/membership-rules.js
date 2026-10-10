export const MEMBERSHIP_RULES = Object.freeze({ earnPerVnd: 10000, pointValueVnd: 1000, maxDiscountPercent: 30 });
export const MEMBERSHIP_REWARDS = Object.freeze([
    { key: "keepsake", name: "Quà lưu niệm CineStar", type: "gift", pointsCost: 50, description: "Một món quà lưu niệm CineStar, nhận tại quầy rạp." },
    { key: "popcorn-combo", name: "Combo bắp & nước", type: "combo", pointsCost: 80, description: "Một bắp rang và một nước uống cơ bản, nhận tại quầy rạp." },
    { key: "movie-ticket", name: "Vé xem phim", type: "ticket", pointsCost: 120, description: "Miễn phí một ghế theo giá suất chiếu khi đặt vé. Không bao gồm combo." },
]);
const DAY = 86400000;
export function vietnamToday(now = new Date()) {
    const date = new Date(now);
    if (!Number.isFinite(date.getTime())) throw new Error("Thời gian không hợp lệ.");
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
export function validateBirthDate(value, now = new Date()) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ngày sinh cần theo định dạng năm-tháng-ngày.");
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value || value < "1900-01-01" || value > vietnamToday(now)) throw new Error("Ngày sinh phải có thật, từ năm 1900 và không ở tương lai.");
    return value;
}
export function membershipTier(lifetimePoints = 0) {
    const tiers = [{ name: "Thành viên", minPoints: 0 }, { name: "Bạc", minPoints: 100 }, { name: "Vàng", minPoints: 300 }, { name: "Kim cương", minPoints: 1000 }];
    const index = Math.max(0, tiers.findLastIndex(tier => lifetimePoints >= tier.minPoints));
    return { ...tiers[index], nextName: tiers[index + 1]?.name ?? null, nextAt: tiers[index + 1]?.minPoints ?? null };
}
export function membershipCardNumber(userId) {
    // Retain all identifier characters to avoid collisions from abbreviated UUIDs.
    return `CV${String(userId).replace(/[^a-z0-9]/gi, "").toUpperCase()}`;
}
export function birthdayWindow(birthDate, now = new Date()) {
    const empty = { active: false, used: false, discountPercent: 20, startsOn: null, endsOn: null, year: null };
    if (!birthDate) return empty;
    validateBirthDate(birthDate, now);
    const today = vietnamToday(now), currentYear = Number(today.slice(0, 4));
    const todayMs = Date.parse(`${today}T00:00:00Z`);
    const windows = [currentYear - 1, currentYear, currentYear + 1].map(year => {
        let anniversary = `${year}${birthDate.slice(4)}`;
        // The birthday of a leap-day member falls on February 28 in ordinary years.
        if (birthDate.endsWith("02-29") && new Date(`${anniversary}T00:00:00Z`).getUTCMonth() !== 1) anniversary = `${year}-02-28`;
        const center = Date.parse(`${anniversary}T00:00:00Z`);
        return { ...empty, year, startsOn: new Date(center - 10 * DAY).toISOString().slice(0, 10), endsOn: new Date(center + 10 * DAY).toISOString().slice(0, 10), active: Math.abs(todayMs - center) <= 10 * DAY, center };
    });
    const selected = windows.find(window => window.active) ?? windows.find(window => window.center >= todayMs) ?? windows[2];
    const { center: _center, ...result } = selected;
    return result;
}
