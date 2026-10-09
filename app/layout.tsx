import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CineVerse — Một thế giới điện ảnh",
  description: "Khám phá phim, chọn ghế và đặt vé tại CineVerse. Đồ án quản lý rạp chiếu phim với trợ lý Gemini.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
