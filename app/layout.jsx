import "./globals.css";
import "./theme.css";
export const metadata = {
    title: "CineStar — Một thế giới điện ảnh",
    description: "Khám phá phim, chọn ghế và đặt vé tại CineStar. Đồ án quản lý rạp chiếu phim với trợ lý Gemini.",
    icons: {
        icon: "/favicon.svg",
        shortcut: "/favicon.svg",
    },
};
export default function RootLayout({ children, }) {
    return (<html lang="vi" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{document.documentElement.dataset.theme=localStorage.getItem("cinestar-theme")==="light"?"light":"dark"}catch{}` }}/></head>
      <body className="antialiased">{children}</body>
    </html>);
}
