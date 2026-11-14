# Thanh toán SePay cho starstart.world

Website tạo đơn chờ thanh toán, hiển thị VietQR theo số tiền do máy chủ tính và chỉ phát hành vé khi webhook HMAC hợp lệ khớp ngân hàng, tài khoản, mã đơn và số tiền. Giữ nguyên hạn tối đa 10 phút từ lúc chọn ghế; tạo QR hoặc tải lại trang không gia hạn. Trong production, khách không thể dùng thanh toán giả lập. Quầy bán vé dùng tiền mặt và nhân viên chỉ xác nhận sau khi đã thu đủ tiền.

## 1. Cloudflare

Các biến công khai đã nằm trong `cloudflare.production.json`:

```text
PAYMENT_MODE=sepay
SEPAY_BANK=MBBank
SEPAY_ACCOUNT_NUMBER=0386492164
SEPAY_ACCOUNT_NAME=TRAN VE NAM
```

Thêm **runtime Secret** `SEPAY_WEBHOOK_SECRET` ở Cloudflare → Workers & Pages → `cinestar` → Settings → Variables and Secrets. Dùng chuỗi ngẫu nhiên tối thiểu 32 ký tự và cùng một giá trị trong phần HMAC của SePay. Không đặt secret trong Build variables, Git, `NEXT_PUBLIC_*` hay `VITE_*`.

Nếu CLI đã đăng nhập Cloudflare, có thể chuẩn bị và tải secret mà không in giá trị ra terminal:

```powershell
npm run sepay:setup
node scripts/setup-sepay.mjs --upload-secret
```

`sepay:setup` lưu secret trong `.dev.vars` bị Git bỏ qua. Script không đổi secret đã tồn tại. Nếu file đang có `PAYMENT_MODE=demo`, đổi thành `sepay` để thử QR local. Không dùng chung secret giữa môi trường test và production khi vận hành thật.

Deploy theo cấu hình GitHub → Cloudflare hiện có (nhánh `main`). Build command `npm run build:cloudflare`; deploy command `npm run db:migrate:remote && npm run deploy:cloudflare`. Migration `0008_sepay_payments.sql` chỉ bổ sung schema và trigger, giữ các đơn cũ. Hoặc sau khi đăng nhập CLI:

```powershell
npm run build:cloudflare
npm run db:migrate:remote
npm run deploy:cloudflare
```

Kiểm tra GET `https://starstart.world/api/payments/sepay/webhook`: sau khi deploy và cấu hình đúng trả `{"provider":"sepay","mode":"sepay","configured":true}`. GET chỉ kiểm tra cấu hình, không xác nhận đã nhận webhook từ ngân hàng. Thiếu secret thì `configured:false`, POST trả 503 và khách chưa được tạo đơn chuyển khoản.

## 2. Cấu hình mã thanh toán trong SePay

Vào Cấu hình Công ty → Cấu hình chung → Cấu trúc mã thanh toán, bật nhận diện và thêm mẫu:

| Trường | Giá trị |
|---|---|
| Tiền tố | `CV` |
| Hậu tố tối thiểu | `10` |
| Hậu tố tối đa | `10` |
| Loại ký tự | Số và chữ |

Ví dụ `CV12AB34CD56`. Test mode và Live có cấu hình riêng.

## 3. Form webhook đang mở

| Trường | Giá trị |
|---|---|
| Tên | Thanh toán vé CineStar |
| URL nhận webhook | `https://starstart.world/api/payments/sepay/webhook` |
| Loại giao dịch | Tiền vào |
| Định dạng | JSON (`application/json`) |
| Tự động gửi lại khi server lỗi | Bật |
| Tài khoản | Chọn đúng tài khoản MB kết thúc `2164` |
| Dùng để xác thực thanh toán | Bật |
| Chỉ gửi khi có mã thanh toán | Bật |
| Lọc mã | `CV` |
| Xác thực | HMAC-SHA256 |
| Secret Key | Giống `SEPAY_WEBHOOK_SECRET` của Worker |

Giữ secret riêng; nhập trực tiếp ở SePay và Cloudflare. Webhook kiểm tra `X-SePay-Signature: sha256=...` trên `{timestamp}.{raw_body}` và `X-SePay-Timestamp` lệch tối đa 5 phút. Không cần User API token chỉ để nhận webhook và tạo ảnh QR.

## 4. Kiểm thử

Local:

```powershell
npm run db:init
npm run sepay:setup
npm run dev
```

Mở `http://localhost:5173`. Khách chọn ghế → thanh toán → Tiếp tục đến mã QR. Dùng Test mode SePay với địa chỉ tunnel/test HTTPS riêng để thử toàn bộ luồng từ SePay, không trỏ giao dịch giả vào production. Trong kiểm thử tự động, chỉ dùng tài khoản, suất chiếu và cơ sở dữ liệu local riêng:

```powershell
npm run check
npm run test:sepay
node scripts/test-sepay-api.mjs
npm run test:email
```

Trong Live, nút Gửi thử trên SePay thường gửi ID giao dịch mẫu bằng `0`. Với bản tin mẫu đúng cấu trúc và chữ ký HMAC hợp lệ, endpoint trả `{"success":true,"outcome":"test_received"}` để xác nhận kết nối, không ghi giao dịch, không đổi trạng thái đơn và không phát hành vé. Bản tin không có chữ ký hợp lệ vẫn bị từ chối. Nếu dữ liệu mẫu dùng ID dương, các điều kiện khớp giao dịch thông thường vẫn áp dụng. Sau đó kiểm tra một đơn thật do bạn tạo: QR đúng người nhận, số tiền, mã đơn; chỉ tự chuyển tiền khi bạn chủ động quyết định thử giao dịch thật. Sau chuyển khoản, đơn tự đổi sang đã thanh toán và có thể xuất vé. Không có nút khách tự xác nhận đã trả tiền.

## 5. Đối soát và hoàn tiền

- Admin → Thanh toán SePay hiển thị 100 webhook gần nhất và đơn hủy chờ hoàn tiền. Webhook lưu payload gốc trong DB, không công khai cho khách.
- `payment_events.transaction_id` duy nhất; nhận lặp không ghi nhận tiền hay gửi email lần nữa. Khi lỗi DB, toàn bộ ghi nhận giao dịch và đơn được rollback để SePay có thể thử lại.
- Chỉ khớp **một giao dịch tiền vào đúng bằng tổng đơn**. Chuyển thiếu/thừa, chia nhiều lần, sai mã, sai ngân hàng hoặc tài khoản: cần đối soát thủ công.
- Tiền đến sau khi hết hạn/hủy, hoặc chuyển thêm cho đơn đã trả: lưu để đối soát; không tự lấy lại ghế có thể đã bán cho người khác.
- Đơn chờ hết hạn tự trả ghế và quyền lợi thành viên đúng một lần. Kiểm tra hạn khi đọc đơn, xem/chọn ghế, nhận webhook và cron mỗi 5 phút.
- Hủy vé đã trả tiền mở lại ghế theo quy định, hoàn điểm/ưu đãi và cấp một vé miễn phí cho mỗi ghế đã hủy (vé thưởng đã dùng được khôi phục và tính trong số vé đó). Đơn SePay mới hủy theo chính sách này có `refund_status=none`; không hoàn bằng tiền. Danh sách `refund_status=pending` của các đơn đã hủy trước khi áp dụng chính sách vẫn cần được rạp đối soát và xử lý. Nút Ghi nhận đã hoàn tiền chỉ ghi nhật ký sau khi rạp thực hiện giao dịch hoàn riêng. Tích hợp không có chức năng tự chuyển tiền ra.
- Khi vận hành, đối soát giao dịch từ dashboard SePay/ngân hàng định kỳ để tìm giao dịch webhook bị bỏ lỡ; chưa có tác vụ tự gọi API ngân hàng để bù giao dịch thiếu.

## Tài liệu chính thức

- https://developer.sepay.vn/vi/sepay-webhooks/tao-webhook
- https://developer.sepay.vn/vi/sepay-webhooks/xac-thuc
- https://developer.sepay.vn/vi/sepay-webhooks/tich-hop-webhook
- https://developer.sepay.vn/vi/tien-ich-khac/tao-qr-code
