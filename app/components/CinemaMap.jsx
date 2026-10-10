"use client";
import { useEffect, useRef, useState } from "react";
import { MapPin, RefreshCw } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

export default function CinemaMap({ cinema }) {
    const container = useRef(null);
    const [status, setStatus] = useState("waiting");
    const [attempt, setAttempt] = useState(0);
    const token = cinema?.mapboxToken;
    const longitude = cinema?.center?.[0];
    const latitude = cinema?.center?.[1];
    const name = cinema?.name || "CineStar";
    const configured = Boolean(token && Number.isFinite(longitude) && Number.isFinite(latitude));

    useEffect(() => {
        if (!configured) return;
        const host = container.current;
        let disposed = false;
        let map;
        let resize;
        let timeout;
        const observer = new IntersectionObserver(async ([entry]) => {
            if (!entry.isIntersecting) return;
            observer.disconnect();
            setStatus("loading");
            try {
                // The bundled entry keeps workers isolated from the dev server's HMR client.
                const { default: mapboxgl } = await import("mapbox-gl");
                const { Map, Marker, NavigationControl } = mapboxgl;
                if (disposed) return;
                map = new Map({
                    container: host,
                    accessToken: token,
                    style: "mapbox://styles/mapbox/dark-v11",
                    center: [longitude, latitude],
                    zoom: 15,
                    scrollZoom: false,
                    cooperativeGestures: true,
                    attributionControl: true,
                });
                map.addControl(new NavigationControl({ showCompass: false }), "top-right");
                new Marker({ color: "#ff674d" }).setLngLat([longitude, latitude]).addTo(map);
                map.getCanvas().setAttribute("aria-label", `Bản đồ vị trí rạp ${name}`);
                map.on("load", () => { if (!disposed) { clearTimeout(timeout); setStatus("ready"); } });
                map.on("error", () => { if (!disposed) { clearTimeout(timeout); setStatus("error"); } });
                timeout = setTimeout(() => { if (!disposed) setStatus("error"); }, 15000);
                resize = new ResizeObserver(() => map.resize());
                resize.observe(host);
            } catch {
                if (!disposed) setStatus("error");
            }
        }, { rootMargin: "200px" });
        observer.observe(host);
        return () => {
            disposed = true;
            observer.disconnect();
            resize?.disconnect();
            clearTimeout(timeout);
            map?.remove();
            host.replaceChildren();
        };
    }, [configured, token, longitude, latitude, name, attempt]);

    return <div className="cv-cinema-map">
        <div ref={container} className="cv-cinema-map-canvas" />
        {(!configured || status !== "ready") && <div className="cv-map-placeholder" role="status">
            <div className="cv-map-pin"><MapPin size={26} strokeWidth={1.5}/></div>
            <strong>{!configured ? "Hẹn gặp bạn tại CineStar" : status === "error" ? "Bản đồ tạm thời chưa khả dụng" : "Đang tải bản đồ…"}</strong>
            <p>{!configured ? "Bản đồ vị trí rạp sẽ sớm được cập nhật." : status === "error" ? "Bạn vẫn có thể xem địa chỉ rạp bên dưới." : "Một chút nữa là đến rạp."}</p>
            {configured && status === "error" && <button className="cv-map-retry" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={13}/> Thử lại</button>}
        </div>}
    </div>;
}
