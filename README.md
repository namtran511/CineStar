# CineStar

Deploy GitHub → Cloudflare Workers: xem [hướng dẫn triển khai](docs/DEPLOY-CLOUDFLARE.md).

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

## Email xác minh và thông báo

Đã có đăng ký bằng mã email 6 số, thông báo đặt/hủy vé, sự cố theo suất chiếu, ưu đãi và lời chúc sinh nhật. Xem [hướng dẫn cấu hình Resend](docs/EMAIL.md). Chạy `npm run db:init` để áp dụng migration mới. Đăng ký mới yêu cầu cấu hình email; tài khoản cũ vẫn đăng nhập được và xác minh tại **Thẻ thành viên → Thông báo qua email**. Admin theo dõi tại **Thông báo email**. Chạy `npm run test:email` để kiểm tra mà không gửi mail thật.

## Tài khoản demo có sẵn

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Quản trị | admin@cineverse.vn | Demo@123 |
| Nhân viên | staff@cineverse.vn | Demo@123 |
| Người dùng | user@cineverse.vn | Demo@123 |

Trong cửa sổ đăng nhập có nút điền sẵn ba tài khoản. Đăng ký mới luôn tạo vai trò người dùng. Admin và nhân viên đăng nhập sẽ mở khu vực quản lý; nút về website cho phép xem giao diện khách hàng.

## Thẻ thành viên và tài khoản

Khách hàng mở menu tên tài khoản → **Thẻ thành viên** để xem mã thẻ, hạng, điểm khả dụng, lịch sử điểm, ưu đãi sinh nhật và ví quà. Admin quản lý tại **Tài khoản** và **Quà thành viên**. Nhân viên cũng có mục **Quà thành viên** để tra mã/tên/email khách, đối chiếu và xác nhận giao quà hoặc combo. Mã chỉ được dùng một lần; hệ thống lưu người và thời điểm giao quà. Vé thưởng vẫn dùng ở bước đặt vé của khách.

- Mỗi 10.000đ thực trả tích 1 điểm khi nhân viên soát vé; làm tròn xuống theo đơn. Thanh toán chưa soát vé chưa cộng điểm.
- 1 điểm giảm 1.000đ, tối đa 30% giá trị đơn. Hạng Bạc/Vàng/Kim cương lần lượt cần 100/300/1.000 điểm đã tích lũy; tiêu điểm không giảm hạng.
- Đổi 50 điểm lấy quà lưu niệm, 80 điểm lấy combo bắp và nước, 120 điểm lấy vé thưởng miễn phí một ghế. Quà/combo có mã nhận tại quầy và admin xác nhận giao một lần; vé thưởng chọn ở bước thanh toán, không bao gồm combo.
- Ngày sinh bắt buộc khi đăng ký. Tài khoản cũ được bổ sung một lần; nhân viên/admin được sửa sau đó. Nhân viên dùng mục **Khách hàng**, chỉ được sửa ngày sinh của khách và phải nhập lý do. Ngày phải có thật và không ở tương lai.
- Trong 10 ngày trước đến 10 ngày sau sinh nhật (tính cả hai đầu, theo giờ Việt Nam), website hiện thông báo giảm 20% một đơn mỗi kỳ sinh nhật. Sinh ngày 29/2 được tính ngày 28/2 trong năm không nhuận.
- Mỗi đơn dùng một loại ưu đãi: mã khuyến mãi, điểm, sinh nhật hoặc vé thưởng. Hủy vé hợp lệ hoàn điểm đã dùng và mở lại quyền dùng ưu đãi/vé thưởng; không hoàn điểm đổi quà khi hủy vé thưởng.
- Admin thêm/sửa/xóa tài khoản, xem điểm và hạng, đổi mật khẩu và ngày sinh. Xóa vô hiệu hóa đăng nhập và thu hồi phiên, giữ vé, đánh giá và lịch sử điểm. Đổi email/mật khẩu/vai trò yêu cầu đăng nhập lại. Hệ thống giữ ít nhất một admin hoạt động và không cho tự xóa tài khoản đang đăng nhập.

Quy tắc và danh mục quà nằm trong `lib/membership-rules.js`. Điểm, ví quà, giao dịch và quyền hưởng ưu đãi được lưu trong D1, với giao dịch nguyên tử chống trừ/cộng điểm hoặc dùng ưu đãi hai lần khi có yêu cầu đồng thời. Migration `0002_membership_loyalty.sql` được áp dụng bằng `npm run db:init`, không xóa dữ liệu cũ.

## Cộng điểm và nhật ký thay đổi

Admin vào **Tài khoản → nút + (Cộng điểm)**, nhập số điểm và lý do rồi xác nhận. Điểm thưởng thủ công tăng số dư để đổi quà/giảm giá, không tăng tổng điểm xếp hạng từ vé. Khách thấy giao dịch trong lịch sử điểm. Máy chủ chống cộng trùng khi gửi lại cùng yêu cầu, và chỉ cho cộng vào tài khoản khách đang hoạt động.

**Nhân viên → Khách hàng** cho phép tìm tên, email hoặc mã thẻ và sửa ngày sinh với lý do. Nhân viên không có quyền cộng điểm, sửa vai trò/mật khẩu hoặc truy cập báo cáo nội bộ. Sửa ngày sinh có kiểm tra giá trị cũ để tránh ghi đè thay đổi vừa được người khác lưu; không xóa quyền sinh nhật đã dùng.

**Admin → Nhật ký thay đổi** xem và lọc các thay đổi nghiệp vụ từ khi tính năng được bật: tài khoản/ngày sinh/điểm, phim, phòng, suất chiếu, combo, ưu đãi, vé/ghế, đánh giá, quà và giao dịch thành viên. Mỗi log ghi thời gian, người thực hiện, loại thao tác, giá trị trước/sau, lý do nếu có và mã yêu cầu. Không lưu mật khẩu, hash mật khẩu hoặc token phiên.

Migration `0003_immutable_audit.sql` tạo trigger ghi log; `0004_audit_insert_guard.sql` bảo vệ cả ghi đè bằng REPLACE. Log không có API sửa/xóa và CSDL từ chối UPDATE/DELETE/REPLACE trên bản ghi đã có. Không đặt khóa ngoại xóa dây chuyền từ tài khoản sang log. Ngữ cảnh người thực hiện và thay đổi dữ liệu được ghi trong cùng batch D1, chống lẫn danh tính khi có nhiều yêu cầu đồng thời. Thay đổi trực tiếp CSDL ngoài ứng dụng vẫn có log với nhãn **Hệ thống / ngoài ứng dụng**. Quyền của người sở hữu hạ tầng CSDL nằm ngoài phân quyền admin/nhân viên của website.

Chạy `npm run db:init` để áp dụng migration trên bản local khác; `npm run test:audit` kiểm tra nghiệp vụ và tính bất biến. Bản ghi thử nghiệm có nhãn QA được giữ trong nhật ký, dù tài khoản thử đã được dọn; không xóa log để dọn kiểm thử.

## Báo cáo quản trị, Excel và Gemini

Admin → **Tổng quan** mặc định xem năm hiện tại. Chọn năm/tháng/ngày rồi bấm **Xem báo cáo**; toàn năm có thể nhóm theo tháng hoặc ngày, một tháng nhóm theo ngày, một ngày nhóm theo giờ. Tất cả mốc thời gian dùng giờ Việt Nam. Bấm **Xuất Excel** để tải `.xlsx` thật với bảy trang: tổng quan, thời gian, phim, trạng thái đơn, thanh toán, thứ trong tuần và BXH thành viên.

Doanh thu là tiền thực trả được lưu khi đặt vé, gồm combo sau ưu đãi, chỉ cộng đơn `paid`/`checked_in`. Số vé là số ghế; đơn hủy hiển thị riêng. Báo cáo theo ngày **đặt vé**, không theo ngày chiếu. Không có API sửa số liệu báo cáo; API cập nhật đơn từ chối gửi thêm trường tiền/ghế. Thay đổi giá danh mục không tính lại đơn cũ. Hủy/soát vé hợp lệ vẫn tự cập nhật trạng thái thống kê.

Các biểu đồ gồm đường/miền doanh thu, cột số vé, thanh ngang phim nổi bật, vòng tròn trạng thái đơn, tròn phương thức thanh toán và cột theo thứ. BXH dựa trên chi tiêu trong kỳ của thành viên đang hoạt động; điểm và hạng hiện tại được ghi riêng. Mỗi biểu đồ có bảng số liệu để đọc chính xác. Excel xuất đủ các dòng, kể cả ngoài top phim đang hiển thị.

Kỳ đã kết thúc so sánh với toàn kỳ liền trước; kỳ đang diễn ra so sánh cùng thời lượng đã trôi qua, chặn ở cuối kỳ trước. Nếu kỳ trước có thêm ngày, biểu đồ giữ các mốc đó với nhãn riêng. Kỳ trước bằng không sẽ không tạo phần trăm tăng trưởng giả.

**Gemini phân tích tất cả** hoặc nút **Phân tích** ở từng mục sử dụng `GEMINI_API_KEY`/`GEMINI_MODEL` có sẵn. Máy chủ tự đọc lại CSDL, chỉ gửi tổng hợp đã tính; không gửi tên, email, ngày sinh, mã thẻ hay mã tài khoản thành viên. Nhận xét định tính và đề xuất nằm cạnh số liệu chính xác do máy chủ tính, không thể sửa doanh thu. Đổi bộ lọc xóa nhận xét cũ. Nếu Gemini không khả dụng, giao diện ghi rõ **Gợi ý cơ bản**, không giả làm phản hồi Gemini. API này chỉ dành cho admin, tách khỏi chat phim công khai.

Kiểm tra riêng bằng `npm run test:analytics`. Không cần cấu hình thêm thư viện Excel hoặc API key mới.

## Kết nối Gemini

Tạo API key trong [Google AI Studio](https://aistudio.google.com/apikey), sao chép `.dev.vars.example` thành `.dev.vars`:

```dotenv
GEMINI_API_KEY=YOUR_SERVER_SIDE_API_KEY
GEMINI_MODEL=gemini-2.5-flash
```

Khởi động lại server. `.dev.vars` được Git bỏ qua. Khóa nằm ở phía máy chủ, không đưa vào biến `NEXT_PUBLIC_*` hay mã trình duyệt. `.env.example` ghi tên biến để tham khảo; với môi trường Cloudflare local, dùng `.dev.vars` như trên. Trên bản hosted, cấu hình `GEMINI_API_KEY` và `GEMINI_MODEL` bằng môi trường/secrets của hosting.

Có thể đặt `GEMINI_MODEL=gemini-3.1-flash-lite` nếu model này có quyền truy cập và hạn mức trong tài khoản của bạn. Bản local hiện đã kiểm tra kết nối bằng model này; hạn mức do Google áp dụng theo tài khoản/model.

API: `POST /api/ai` với `{"message":"Gợi ý phim cho gia đình tối nay dưới 100k"}`. Đọc hướng dẫn chính thức tại [Gemini Structured Outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

Gemini nhận danh mục công khai mới nhất từ CSDL và tối đa 8 lượt trò chuyện gần nhất, tự diễn giải tâm trạng/hoàn cảnh của khách, so sánh phim và viết lời tư vấn tự nhiên bằng tiếng Việt. Chế độ suy luận được bật; câu hỏi không cần chứa từ khóa thể loại. Server kiểm tra ID, độ tuổi, ngân sách và suất chiếu; các tham chiếu tên phim, thông tin phim, giờ/giá vé, combo và mã ưu đãi trong lời tư vấn được thay bằng bản ghi CSDL. AI có thể hỏi thêm khi chưa đủ thông tin và phải nói rõ khi mô tả phim chưa đủ để đánh giá cường độ từng cảnh. Lịch sử là ngữ cảnh do trình duyệt gửi, không phải bằng chứng về thông tin hay quyền truy cập.

API nhận `message` (tối đa 2000 ký tự) và `history` tùy chọn gồm `{ role: "user" | "assistant", text, movieIds? }`; tối đa 8 mục, mỗi mục 1000 ký tự. Không cho Gemini thực thi SQL hay truy cập tài khoản, mật khẩu, đơn vé hoặc doanh thu. Câu hỏi ngoài phạm vi được hướng lại CineVerse. Khi thiếu khóa hoặc Gemini không phản hồi hợp lệ, giao diện hiển thị **Demo** và dùng gợi ý có quy tắc. Server có tối đa một lần thử lại cho lỗi dịch vụ tạm thời hoặc tham chiếu dữ liệu không hợp lệ, với tổng thời gian chờ tối đa 45 giây. Chạy `npm run test:ai` để kiểm tra tham chiếu dữ liệu và giới hạn lịch sử mà không gọi Google.

## Ngôn ngữ và kiểm tra

Mã nguồn dùng JavaScript: `.jsx` cho giao diện React, `.js` cho API/nghiệp vụ và `.mjs` cho script ESM. `jsconfig.json` cấu hình alias `@/`. `npm run check` kiểm tra cú pháp JavaScript/JSX và các import nội bộ; `npm run build` kiểm tra việc đóng gói toàn bộ ứng dụng. Các thư viện phụ thuộc có thể vẫn mang theo khai báo kiểu hoặc công cụ TypeScript của riêng chúng.

## Thanh toán

Toàn bộ MoMo, chuyển khoản và thẻ là **giả lập**. Không sandbox, không cổng thanh toán ngoài, không thu thông tin thẻ và không trừ tiền. Xác nhận thanh toán tạo đơn trạng thái `paid`. Tổng tiền được tính ở server từ ghế, giá suất chiếu, combo và mã ưu đãi đang hiệu lực.

## Giữ ghế khi chọn

Khách hàng và nhân viên bán vé tại quầy được giữ ghế ngay khi chọn, trước khi thanh toán. Ghế của bạn có màu đang chọn; ghế người khác đang giữ có màu riêng và không thể chọn; ghế đã mua hiển thị đã đặt. Sơ đồ ghế cập nhật mỗi giây và đồng hồ đếm ngược hiển thị thời gian giữ còn lại.

Mỗi lượt giữ tối đa 8 ghế trong **10 phút tính từ lần chọn đầu tiên**, theo đồng hồ máy chủ; nếu suất chiếu gần giờ đóng bán, thời hạn giữ kết thúc sớm hơn tại mốc 10 phút trước giờ chiếu. Thêm/bớt ghế không kéo dài thời hạn. Bỏ chọn, đổi suất hoặc đóng phần đặt vé sẽ yêu cầu nhả ghế; khi mất kết nối hoặc đóng trình duyệt, ghế vẫn tự hết hạn theo thời gian máy chủ. Hết hạn phải chọn lại trước khi thanh toán. Máy chủ xử lý tranh chấp ghế nguyên tử, nên hai người chọn đồng thời chỉ có một người giữ được ghế.

Chạy `npm run db:init` để áp dụng migration giữ ghế, rồi khởi động lại server local. Kiểm tra bằng `npm run test:seat-holds` khi server đang mở; bộ test dùng dữ liệu QA riêng, gồm tranh chấp đồng thời, hết hạn, nhả ghế và thanh toán. Không xóa dữ liệu cũ để áp dụng thay đổi.

## Đánh giá phim sau khi xem

Khách hàng có thể chấm **1–10 điểm** và viết nhận xét trong trang chi tiết phim sau khi vé của mình đã được nhân viên soát (`checked_in`) và suất chiếu đã kết thúc (giờ bắt đầu + thời lượng phim). Vé đã hủy, vé chưa soát hoặc phim vẫn đang chiếu chưa đủ điều kiện. Mỗi tài khoản khách hàng được gửi một đánh giá cho mỗi phim, kể cả khi mua nhiều vé hoặc xem nhiều lần; đánh giá đã gửi được giữ nguyên.

Điểm tổng là **trung bình cộng các điểm khách hàng đã gửi**, kèm số lượt đánh giá. Phim chưa có đánh giá hiển thị “Chưa đánh giá”; điểm mẫu cũ không tham gia phép tính. Admin và nhân viên chỉ đọc đánh giá, không có API thêm/sửa/xóa hay ô nhập điểm phim. CSDL ràng buộc duy nhất khách/phim và khóa ngoại không xóa dây chuyền đánh giá.

Trong menu tài khoản, mở **Đánh giá của tôi** để xem hai mục **Chưa đánh giá** (phim đã xem đủ điều kiện) và **Đã đánh giá**. Từ **Vé của tôi** cũng có đường dẫn tới thư viện này và nút đánh giá trên vé đã xem. Nhận xét được công khai trong chi tiết phim với tên người đánh giá, điểm và ngày gửi; email, mã vé và thông tin tài khoản riêng không công khai.

Khi lấy mã nguồn mới, chạy `npm run db:init` để áp dụng migration bổ sung bảng đánh giá; không cần tạo lại CSDL. Chạy `npm run test:reviews` khi server local đang mở để kiểm tra điều kiện đánh giá, phân quyền, điểm trung bình, chống gửi trùng và lịch sử tài khoản. Test chỉ dùng dữ liệu riêng và tự dọn dữ liệu kiểm thử.

## Cấu trúc mã nguồn

```text
app/page.jsx                  Khởi tạo dữ liệu, đăng nhập/đăng ký, chuyển vai trò
app/components/CustomerApp.jsx Trang khách, AI, chọn ghế, đặt vé và vé của tôi
app/components/ManagementApp.jsx Quản trị, nhân viên, bán vé tại quầy
app/api/                      API xác thực, đặt vé, AI, CRUD quản trị
lib/seed.js                   Phim, phòng, combo, ưu đãi và lịch mẫu
lib/server/                   SQL, phân quyền, nghiệp vụ, Gemini
db/schema.js                  Schema Drizzle
drizzle/                      Migration SQL và metadata
public/images/                Poster và ảnh nền demo, hình combo
scripts/init-db.mjs           Khởi tạo CSDL local theo migration ledger
scripts/smoke-test.mjs         Kiểm tra API và các quy tắc nghiệp vụ
docs/DO-AN.md                 Phạm vi, kiến trúc, ERD, quy tắc và kịch bản demo
```

Admin quản lý danh mục phim, lịch chiếu, phòng, combo và ưu đãi; đánh giá do khách hàng gửi được giữ nguyên. Sửa bộ dữ liệu ban đầu trong `lib/seed.js` chỉ ảnh hưởng CSDL chưa được khởi tạo; các bản ghi đã lưu cần chỉnh qua API/giao diện. Dữ liệu phim đang được suất chiếu/vé/đánh giá sử dụng có ràng buộc khóa ngoại, nên thao tác xóa có thể bị từ chối.

## Liên hệ và hỗ trợ ở footer

Thêm các kênh liên hệ thật vào `.dev.vars`, rồi khởi động lại server. Trên hosting, dùng các biến môi trường cùng tên:

```dotenv
CINEMA_EMAIL=
CINEMA_FACEBOOK_URL=
CINEMA_PHONE=
```

`CINEMA_EMAIL` là địa chỉ email nhận hỗ trợ; `CINEMA_FACEBOOK_URL` là liên kết đầy đủ bắt đầu bằng `https://facebook.com/` hoặc `https://www.facebook.com/`; `CINEMA_PHONE` là số điện thoại liên hệ, có thể chứa dấu `+`, khoảng trắng, dấu gạch ngang và ngoặc đơn. Đây là thông tin công khai được gửi tới trình duyệt. Email, Facebook và điện thoại chưa có hoặc không hợp lệ sẽ để trống; không tự tạo thông tin liên hệ giả.

## Bản đồ Mapbox trong footer

Footer có sẵn địa điểm **Đại học Giao thông Vận tải UTC Hà Nội**, số 3 phố Cầu Giấy, phường Láng, Hà Nội. Tọa độ được lấy từ bản đồ nhúng trên [trang liên hệ UTC](https://tuyensinh.utc.edu.vn/?q=lien-he), cấu hình mặc định tại `lib/cinema-location.js`.

Để bật bản đồ, thêm dòng sau vào `.dev.vars` rồi khởi động lại `npm run dev`:

```dotenv
MAPBOX_PUBLIC_TOKEN=pk.your_mapbox_public_token
```

Dùng **public token bắt đầu bằng `pk.`** trong tài khoản [Mapbox](https://docs.mapbox.com/help/getting-started/access-tokens/). Token này được gửi tới trình duyệt; token bí mật `sk.` không được chấp nhận. Nếu giới hạn URL cho token, cho phép địa chỉ localhost dùng để thử và tên miền website khi triển khai. Môi trường triển khai cần cấu hình biến `MAPBOX_PUBLIC_TOKEN` trong Worker.

Có thể ghi đè địa điểm bằng `CINEMA_NAME`, `CINEMA_ADDRESS`, `CINEMA_LONGITUDE`, `CINEMA_LATITUDE` trong cùng môi trường. Khi đổi vị trí, điền cả kinh độ và vĩ độ. Để trống các biến này sẽ dùng UTC Hà Nội.

Chưa có token: footer vẫn hiển thị địa chỉ và nút chỉ đường, không gửi yêu cầu tới Mapbox. Khi có token: bản đồ nền tối, ghim vị trí và nút thu/phóng được tải khi người dùng cuộn gần footer. Bản đồ có thông báo và nút thử lại nếu không tải được. Chức năng chỉ đường mở Google Maps trong tab mới.

## Kiểm tra và build

```bash
npm run check
npm run build
npm run test:smoke
npm run test:checkin
npm run test:reviews
npm run test:membership
npm run test:ai
npm run test:analytics
```

Chạy smoke test khi server local đang mở. Test tạo tài khoản và dữ liệu QA trong CSDL local để kiểm tra phân quyền, dữ liệu riêng, chống trùng ghế, giá tính trên server, soát/hủy vé, CRUD và phạm vi AI. Test từ chối chạy trên host không phải loopback.

`npm start` chạy bản build Worker local; `npm run dev` dùng để phát triển với cập nhật trực tiếp. Mã nguồn giữ tích hợp Sites để có thể xuất bản cùng D1; chạy local không cần tài khoản Cloudflare.

## Dữ liệu minh họa

Poster/ảnh nền phim lấy từ CDN TMDB để minh họa giao diện, các hình combo và favicon là SVG trong dự án. Suất chiếu được tạo cho bảy ngày tính từ lần khởi tạo CSDL; không phải lịch của rạp thật. Khi cần ngày mới, admin thêm/sửa suất chiếu. Báo cáo tính từ đơn thực tế trong CSDL, không dùng số doanh thu giả.

Chi tiết để trình bày và bảo vệ: [docs/DO-AN.md](docs/DO-AN.md).
