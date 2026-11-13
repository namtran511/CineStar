# Deploy CineStar từ GitHub lên Cloudflare Workers

Repo: https://github.com/namtran511/CineStar

Đây là ứng dụng có API và D1, dùng **Workers**, không phải GitHub Pages.
Repo chứa nội dung thư mục `cineverse` ở cấp gốc.

## 1. Tạo Worker và nhập Secrets trước khi chạy web

Trong Cloudflare Workers & Pages, tạo Worker tên `cinestar` (có thể bắt đầu bằng Hello World).
Vào Settings → Variables and Secrets, thêm:

| Tên | Loại | Giá trị |
| --- | --- | --- |
| `GEMINI_API_KEY` | Secret | Khóa Gemini mới của bạn |
| `INITIAL_ADMIN_EMAIL` | Secret | Email dùng đăng nhập admin |
| `INITIAL_ADMIN_PASSWORD` | Secret | Mật khẩu riêng, 16–128 ký tự, không có khoảng trắng đầu/cuối |
| `MAPBOX_PUBLIC_TOKEN` | Text | Token Mapbox `pk...` đã giới hạn tên miền |

Nhập các giá trị trực tiếp trên Cloudflare, không gửi qua chat hay commit vào Git.
`APP_ENV=production` và model Gemini đã có trong `cloudflare.production.json`.
Không đặt khóa Gemini trong biến `VITE_*` hoặc `NEXT_PUBLIC_*`.
Secrets trên đây là biến **runtime**, không phải biến Build.

Lần truy cập đầu tiên sau migrations tạo duy nhất admin theo Secrets và dữ liệu danh mục mẫu.
Không tạo ba tài khoản demo trên production; đăng nhập/session của các ID demo bị chặn.
Sau khi admin đã được tạo, có thể xóa hai Secrets `INITIAL_ADMIN_*`.
Thay Secrets sau đó không tự đổi mật khẩu tài khoản đã lưu trong database.

## 2. Kết nối GitHub và cấu hình Build

Worker `cinestar` → Settings → Builds → kết nối repo `namtran511/CineStar`.

- Production branch: `main`.
- Root directory: `/` (file `package.json` nằm ngay cấp gốc repo).
- Build command: `npm run build:cloudflare`.
- Deploy command: `npm run db:migrate:remote && npm run deploy:cloudflare`.
- Build variable: `NODE_VERSION=22.16.0`.
- Chỉ bật deploy nhánh production lúc đầu; preview cần database riêng.

Cloudflare cần quyền deploy Worker và chạy migrations D1. Nếu token build tự tạo thiếu quyền D1,
chỉnh token trong Cloudflare với quyền D1 Edit cho đúng tài khoản, không lưu token vào repo.

Database `cinestar-db` đã khai báo trong `cloudflare.production.json`.
Database ID là định danh công khai, không phải mật khẩu.
Migrations chạy trước deploy và có bảng theo dõi các migration đã áp dụng.
Lần cài đặt này dùng D1 mới; dữ liệu tài khoản, vé và nhật ký local không được upload.

## 3. Kiểm tra sau deploy

Mở URL `workers.dev` do Cloudflare cung cấp, kiểm tra trang chủ, đăng nhập admin bằng thông tin ở bước 1,
đăng ký khách hàng, AI Gemini và bản đồ. Thêm URL đó vào allowed URLs của token Mapbox.
Token Mapbox công khai vẫn nhìn thấy trên trình duyệt; khóa Gemini chỉ dùng tại server.

## Chạy local

Giữ `npm run dev`, `npm run db:init` và `.dev.vars` như trước.
`npm run build` là build local; deploy script từ chối build không có cấu hình production.
`npm run deploy:cloudflare -- --dry-run` kiểm tra gói deploy mà không xuất bản.

## Bảo mật source

Không commit `.dev.vars`, `.env*` thực, `.wrangler`, database SQLite, log, ảnh QA hoặc build output.
Chỉ commit các file `.example` có giá trị trống/mẫu. Gitignore không loại bí mật từng commit trong lịch sử;
cần kiểm tra lịch sử trước push. Repo private không thay thế việc giữ khóa ở Secrets.

Tài liệu chính thức:
- https://developers.cloudflare.com/workers/configuration/secrets/
- https://developers.cloudflare.com/workers/ci-cd/builds/configuration/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://docs.mapbox.com/accounts/guides/tokens/
