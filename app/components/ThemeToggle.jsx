"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
    const [theme, setTheme] = useState("dark");
    useEffect(() => {
        setTheme(document.documentElement.dataset.theme || "dark");
        const sync = (event) => {
            if (event.key !== "cinestar-theme") return;
            const next = event.newValue === "light" ? "light" : "dark";
            document.documentElement.dataset.theme = next;
            setTheme(next);
        };
        window.addEventListener("storage", sync);
        return () => window.removeEventListener("storage", sync);
    }, []);

    const label = theme === "dark" ? "Chuyển sang chế độ sáng" : "Chuyển sang chế độ tối";
    return <button type="button" className="theme-toggle" title={label} aria-label={label} onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        setTheme(next);
        try { localStorage.setItem("cinestar-theme", next); } catch { /* Theme still works when storage is unavailable. */ }
    }}>{theme === "dark" ? <Sun size={19}/> : <Moon size={19}/>}</button>;
}
