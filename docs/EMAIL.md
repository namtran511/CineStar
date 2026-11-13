# Xác minh email và thông báo CineStar

Khách dùng Gmail hoặc địa chỉ email khác đều được. Đây là đăng ký bằng email/mật khẩu và mã xác minh, không phải nút đăng nhập Google OAuth.

## Cấu hình Resend

Tại máy local, chạy `npm run email:setup` để chuẩn bị `.dev.vars` và tự sinh `EMAIL_CODE_SECRET`. Lệnh giữ nguyên các biến đã có, không in khóa ra terminal và không gửi email. Sau đó bạn chỉ cần điền `RESEND_API_KEY`, `EMAIL_FROM` và chỉnh `APP_URL` nếu không dùng địa chỉ local mặc định.

1. Tạo tài khoản tại https://resend.com và thêm tên miền gửi trong **Domains**. Thêm bản ghi DNS theo hướng dẫn Resend, đợi xác minh thành công. Địa chỉ gửi phải thuộc tên miền này, ví dụ `CineStar <no-reply@tenmien-cua-ban.vn>`; không đặt một địa chỉ `@gmail.com` làm người gửi qua Resend.
2. Tạo API key có quyền gửi email. Nhập các giá trị sau vào `.dev.vars` tại máy hoặc **Workers → Settings → Variables and Secrets** khi chạy thật. Đặt API key và mã bí mật dưới dạng secret, không gửi trong chat hoặc commit Git.

```dotenv
RESEND_API_KEY=API_KEY_CUA_BAN
EMAIL_FROM="CineStar <no-reply@tenmien-cua-ban.vn>"
EMAIL_CODE_SECRET=CHUOI_NGAU_NHIEN_IT_NHAT_32_KY_TU
APP_URL=http://localhost:5173
```

`APP_URL` ở production phải là địa chỉ HTTPS thực tế của web, dùng cho liên kết trong email. Có thể đặt `CINEMA_EMAIL` là email hỗ trợ thật. Sinh secret tại máy bằng `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`, rồi giữ trong môi trường riêng của bạn.

3. Chạy `npm run db:init` để áp dụng migration `0007_email_notifications.sql`, khởi động lại server. Với Cloudflare production, chạy `npm run db:migrate:remote` trước khi triển khai bản mới.
4. Kiểm tra **Admin → Thông báo email**. “Đã cấu hình” chỉ kiểm tra đủ biến; dùng một tài khoản email bạn quản lý để kiểm tra việc nhận mã thật sau khi thiết lập.

Tên miền thử `resend.dev` chỉ gửi đến email của chủ tài khoản Resend; để khách khác nhận được cần tên miền riêng đã xác minh. Tham khảo [giới hạn tên miền thử](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), [Send Email API](https://resend.com/docs/api-reference/emails/send-email).

## Luồng hoạt động

- Đăng ký: nhập họ tên, email, mật khẩu và ngày sinh → gửi mã 6 chữ số → xác minh → tạo tài khoản khách và phiên đăng nhập. Chưa nhập đúng mã thì chưa có tài khoản mới. Mã dùng một lần trong 10 phút, tối đa 5 lần nhập sai; gửi lại sau 60 giây, mã cũ mất hiệu lực. Giới hạn 5 yêu cầu/email/giờ và 30 yêu cầu/IP/giờ. Không trả mã trong API, không lưu mã gốc hoặc mật khẩu gốc trong CSDL/log. Dữ liệu đăng ký chờ xác minh được dọn sau 24 giờ khi lịch xử lý chạy.
- Tài khoản cũ và tài khoản admin tạo: vẫn đăng nhập như trước, vào **Thẻ thành viên → Thông báo qua email** để xác minh. Chỉ gửi thông báo đến email đã xác minh; thay email qua admin sẽ thu hồi xác minh và tùy chọn nhận tin.
- Đặt vé: tạo thông báo trong cùng giao dịch CSDL với đơn. Hủy vé: tạo thông báo hủy trong cùng giao dịch. Email mô tả đúng thanh toán giả lập hiện tại, không khẳng định đã thu hoặc hoàn tiền ngân hàng. Nếu hủy trước khi mail đặt vé kịp gửi, mail đặt vé được bỏ qua.
- Sự cố: admin chọn suất và nhập tiêu đề/nội dung, xem trước rồi gửi. Mỗi khách có vé còn hiệu lực và email đã xác minh nhận một mail, kể cả có nhiều đơn. Chỉ admin được gửi. Thao tác không tự hủy vé hoặc đổi lịch. Đây là thông báo do rạp chủ động tạo, không tự suy đoán mọi lỗi kỹ thuật là sự cố cần gửi khách.
- Ưu đãi: khi admin tạo mã đang bật hoặc bật mã từ trạng thái tắt, gửi đến khách đã xác minh và đã bật nhận ưu đãi. Mỗi mã ưu đãi chỉ thông báo một lần cho mỗi khách; sửa nội dung hoặc bật/tắt lặp lại không gửi trùng. Không gửi lại tất cả mã cũ khi khách vừa đồng ý nhận tin.
- Sinh nhật: từ 08:00 giờ Việt Nam đúng ngày sinh, một lần/khách/năm. Sinh 29/2 được chúc vào 28/2 năm không nhuận. Khách bật nhận email sinh nhật riêng với email ưu đãi.
- Khách bật/tắt hai loại email tự nguyện khi đăng ký hoặc trong Thẻ thành viên. Mỗi email ưu đãi/sinh nhật có liên kết ngừng nhận và hỗ trợ List-Unsubscribe One-Click. GET không tự thay đổi tùy chọn để tránh trình quét liên kết vô tình hủy đăng ký. Email vé/sự cố vẫn hoạt động. Hệ thống kiểm tra lại tùy chọn ngay trước khi gửi.

## Gửi nền và kiểm tra lỗi

`cloudflare.production.json` có Cron `*/5 * * * *`. Worker `scheduled()` xử lý hàng đợi ngay cả khi không ai mở web, mỗi lượt tối đa 5 email. Sau thao tác API thành công, Worker xử lý nhanh tối đa 2 email bằng `waitUntil`. Hạn mức gói Resend vẫn áp dụng. Với lượng khách lớn cần tăng thông lượng bằng Cloudflare Queues/lịch phù hợp.

Khi chạy local, không có lịch tự động như production; có thể bấm **Xử lý hàng đợi** trong quản trị. Trên một nền tảng triển khai khác không áp dụng `cloudflare.production.json`, cần cấu hình Cron tương đương; chưa tự xuất bản hoặc cấu hình lịch trên Sites.

Hàng đợi có khóa xử lý và khóa chống gửi trùng phía Resend, thử lại lỗi tạm thời tối đa 5 lần. Không thử lại quá 23 giờ từ khi tạo sự kiện để giữ trong cửa sổ [idempotency 24 giờ của Resend](https://resend.com/docs/dashboard/emails/idempotency-keys). Admin có thể thử lại lỗi trong cửa sổ này; sau đó cần đối soát trong Resend. Email quá hạn hiển thị lỗi, không âm thầm gửi trùng. Trạng thái **Dịch vụ đã nhận** chỉ là API chấp nhận gửi; kiểm tra Resend để biết delivery/bounce, không có webhook delivery/bounce trong phiên bản này.

Nếu chưa cấu hình, đăng ký mới báo chưa sẵn sàng và không bỏ qua OTP. Tài khoản có sẵn vẫn đăng nhập được. Đơn vé không phụ thuộc việc Resend có phản hồi hay không.

## Kiểm thử

`npm run test:email` dùng SQLite trong bộ nhớ và dịch vụ email mô phỏng: không gửi mail ra ngoài, không đọc API key thật, không sửa dữ liệu khách. Kiểm tra xác minh một lần, sai/hết hạn, gửi lại, giới hạn yêu cầu, lỗi dịch vụ, sự kiện giao dịch nguyên tử, tùy chọn nhận tin, sinh nhật, chống gửi trùng và thử lại. Các bài kiểm thử nghiệp vụ khác tạo tài khoản QA qua API quản trị local; không thêm đường bỏ qua OTP cho ứng dụng.
