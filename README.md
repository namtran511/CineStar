# CineVerse

Đồ án website quản lý rạp chiếu phim, giao diện tối, tiếng Việt, ba vai trò **admin / nhân viên / người dùng**. Có đặt vé chọn ghế, combo, ưu đãi, thanh toán giả lập, soát vé, thống kê và trợ lý gợi ý Gemini giới hạn trong CSDL.

## Chạy ngay trên máy Windows hiện tại

Mở **`CHAY-CINEVERSE.cmd`** ở thư mục `uyoccho`, rồi truy cập **http://localhost:5173**. Node.js đã được chuẩn bị riêng trong `.tools`, không thay đổi cài đặt của máy. Cửa sổ terminal cần được giữ mở khi sử dụng; nhấn Ctrl+C để dừng.

## Chạy trên máy khác

Cài Node.js **22.13 trở lên** và mở terminal trong thư mục `cineverse`:

```bash
npm ci
npm run db:init
npm run dev
```

Truy cập địa chỉ Local được in trong terminal (mặc định http://localhost:5173). `db:init` áp dụng các migration chưa chạy; chạy lại an toàn. Dữ liệu mẫu được thêm một lần khi gọi API đầu tiên. Dữ liệu local lưu trong `.wrangler/state`; bản được xuất bản có CSDL riêng.

Có thể dùng `npm run launch` thay cho hai lệnh khởi tạo và chạy sau khi đã cài thư viện.

## Tài khoản demo

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Quản trị | admin@cineverse.vn | Demo@123 |
| Nhân viên | staff@cineverse.vn | Demo@123 |
| Người dùng | user@cineverse.vn | Demo@123 |

Trong cửa sổ đăng nhập có nút điền sẵn ba tài khoản. Đăng ký mới luôn tạo vai trò người dùng. Admin và nhân viên đăng nhập sẽ mở khu vực quản lý; nút về website cho phép xem giao diện khách hàng.

## Kết nối Gemini

Tạo API key trong [Google AI Studio](https://aistudio.google.com/apikey), sao chép `.dev.vars.example` thành `.dev.vars`:

```dotenv
GEMINI_API_KEY=YOUR_SERVER_SIDE_API_KEY
GEMINI_MODEL=gemini-2.5-flash
```

Khởi động lại server. `.dev.vars` được Git bỏ qua. Khóa nằm ở phía máy chủ, không đưa vào biến `NEXT_PUBLIC_*` hay mã trình duyệt. `.env.example` ghi tên biến để tham khảo; với môi trường Cloudflare local, dùng `.dev.vars` như trên. Trên bản hosted, cấu hình `GEMINI_API_KEY` và `GEMINI_MODEL` bằng môi trường/secrets của hosting.

API: `POST /api/ai` với `{"message":"Gợi ý phim cho gia đình tối nay dưới 100k"}`. Đọc hướng dẫn chính thức tại [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

Gemini đọc bản dữ liệu danh mục công khai do server lấy từ CSDL và trả JSON ý định/tiêu chí/ID phim. Server kiểm tra JSON, ID và tạo câu trả lời bằng chính bản ghi CSDL. Không cho Gemini thực thi SQL hay truy cập tài khoản, mật khẩu, đơn vé hoặc doanh thu. Các câu hỏi ngoài phạm vi bị từ chối. Khi chưa có API key hoặc Gemini lỗi, giao diện hiển thị **Demo** và dùng gợi ý có quy tắc từ dữ liệu rạp. Việc gọi Gemini thật cần key hợp lệ của bạn; bản bàn giao không chứa key.

## Thanh toán

Toàn bộ MoMo, chuyển khoản và thẻ là **giả lập**. Không sandbox, không cổng thanh toán ngoài, không thu thông tin thẻ và không trừ tiền. Xác nhận thanh toán tạo đơn trạng thái `paid`. Tổng tiền được tính ở server từ ghế, giá suất chiếu, combo và mã ưu đãi đang hiệu lực.

## Cấu trúc mã nguồn

```text
app/page.tsx                  Khởi tạo dữ liệu, đăng nhập/đăng ký, chuyển vai trò
app/components/CustomerApp.tsx Trang khách, AI, chọn ghế, đặt vé và vé của tôi
app/components/ManagementApp.tsx Quản trị, nhân viên, bán vé tại quầy
app/api/                      API xác thực, đặt vé, AI, CRUD quản trị
lib/types.ts                  Kiểu dữ liệu dùng chung
lib/seed.ts                   Phim, phòng, combo, ưu đãi và lịch mẫu
lib/server/                   SQL, phân quyền, nghiệp vụ, Gemini
db/schema.ts                  Schema Drizzle
drizzle/                      Migration SQL và metadata
public/images/                Poster và ảnh nền demo, hình combo
scripts/init-db.mjs           Khởi tạo CSDL local theo migration ledger
scripts/smoke-test.mjs         Kiểm tra API và các quy tắc nghiệp vụ
docs/DO-AN.md                 Phạm vi, kiến trúc, ERD, quy tắc và kịch bản demo
```

Bạn có thể thêm/sửa/xóa dữ liệu trong giao diện Admin. Sửa bộ dữ liệu ban đầu trong `lib/seed.ts` chỉ ảnh hưởng CSDL chưa được khởi tạo; các bản ghi đã lưu cần chỉnh qua API/giao diện. Dữ liệu phim đang được suất chiếu/vé sử dụng có ràng buộc khóa ngoại, nên thao tác xóa có thể bị từ chối.

## Kiểm tra và build

```bash
npm run check
npm run build
npm run test:smoke
npm run test:checkin
```

Chạy smoke test khi server local đang mở. Test tạo tài khoản và dữ liệu QA trong CSDL local để kiểm tra phân quyền, dữ liệu riêng, chống trùng ghế, giá tính trên server, soát/hủy vé, CRUD và phạm vi AI. Test từ chối chạy trên host không phải loopback.

`npm start` chạy bản build Worker local; `npm run dev` dùng để phát triển với cập nhật trực tiếp. Mã nguồn giữ tích hợp Sites để có thể xuất bản cùng D1; chạy local không cần tài khoản Cloudflare.

## Dữ liệu minh họa

Poster/ảnh nền phim lấy từ CDN TMDB để minh họa giao diện, các hình combo và favicon là SVG trong dự án. Suất chiếu được tạo cho bảy ngày tính từ lần khởi tạo CSDL; không phải lịch của rạp thật. Khi cần ngày mới, admin thêm/sửa suất chiếu. Báo cáo tính từ đơn thực tế trong CSDL, không dùng số doanh thu giả.

Chi tiết để trình bày và bảo vệ: [docs/DO-AN.md](docs/DO-AN.md).
