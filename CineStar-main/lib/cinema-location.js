// Hanoi campus coordinates from https://tuyensinh.utc.edu.vn/?q=lien-he.
const defaultCinema = {
    name: "CineStar · UTC Hà Nội",
    address: "Trường Đại học Giao thông Vận tải, số 3 phố Cầu Giấy, phường Láng, Hà Nội.",
    center: [105.80294215, 21.0277701],
};

function publicEmail(value) {
    const email = String(value || "").trim();
    const [local] = email.split("@");
    const valid = /^[A-Za-z0-9._+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(email);
    return valid && email.length <= 254 && local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") ? email : "";
}

function publicFacebookUrl(value) {
    const raw = String(value || "").trim();
    if (!raw || /\s/.test(raw)) return "";
    try {
        const url = new URL(raw);
        const facebookHost = url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com");
        return url.protocol === "https:" && facebookHost && !url.username && !url.password && !url.port ? url.href : "";
    } catch {
        return "";
    }
}

function publicPhone(value) {
    const phone = String(value || "").trim();
    const digits = phone.replace(/\D/g, "");
    return /^\+?[0-9 ()-]+$/.test(phone) && digits.length >= 7 && digits.length <= 15 ? phone : "";
}

// Only explicitly public fields may be sent to the browser.
export function publicCinemaLocation(env = {}) {
    const coordinate = (value, limit) => {
        if (value == null || String(value).trim() === "") return null;
        const number = Number(value);
        return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
    };
    const longitude = coordinate(env.CINEMA_LONGITUDE, 180);
    const latitude = coordinate(env.CINEMA_LATITUDE, 90);
    const token = String(env.MAPBOX_PUBLIC_TOKEN || "").trim();
    const customCoordinates = [env.CINEMA_LONGITUDE, env.CINEMA_LATITUDE].some(value => value != null && String(value).trim() !== "");
    return {
        name: String(env.CINEMA_NAME || "").trim() || defaultCinema.name,
        address: String(env.CINEMA_ADDRESS || "").trim() || defaultCinema.address,
        center: customCoordinates ? (longitude !== null && latitude !== null ? [longitude, latitude] : null) : defaultCinema.center,
        mapboxToken: token.startsWith("pk.") ? token : "",
        email: publicEmail(env.CINEMA_EMAIL),
        facebookUrl: publicFacebookUrl(env.CINEMA_FACEBOOK_URL),
        phone: publicPhone(env.CINEMA_PHONE),
    };
}
