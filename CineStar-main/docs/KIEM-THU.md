# Kết quả kiểm tra — 09/10/2026

## Sau khi chuyển sang JavaScript

- 118 tệp nguồn/cấu hình được chuyển sang `.js`, `.jsx` hoặc `.mjs`; khai báo chỉ dành cho TypeScript được bỏ. `next-env.d.ts` là tệp tự sinh của framework, được Git bỏ qua.
- `npm run check`: kiểm tra cú pháp và import nội bộ của 137 tệp JavaScript/JSX thành công.
- `npm run build`: build RSC, client, SSR và toàn bộ API thành công.
- `npm run test:ai`: 40 kiểm tra dữ liệu và hội thoại thành công, chạy trực tiếp các module JavaScript.
- `npm run test:smoke`: 46 kiểm tra API thành công khi Gemini đã cấu hình; nhánh Demo thiếu key không chạy trong lượt này. Dữ liệu riêng của lượt kiểm tra đã được dọn.
- `npm run test:checkin`: 10 kiểm tra soát vé, lịch chiếu và số liệu thành công; dữ liệu kiểm tra đã được dọn.
- Edge: đăng nhập admin, mở cả chín mục quản trị, đăng xuất, tìm kiếm/xem chi tiết phim đều thành công, không có lỗi JavaScript phía trình duyệt.
- Banner: chuyển tự động sau bốn giây kể cả khi rê chuột hoặc sau khi bấm nút; tám ảnh ngang phủ banner, tám trailer, tạm dừng và giao diện mobile đều đạt. Bảy trường hợp hiển thị trạng thái Gemini cũng đạt.

## Đánh giá phim sau khi xem — 10/10/2026

- Migration `0001_customer_movie_reviews.sql` áp dụng thành công vào CSDL local hiện có; không tạo lại hoặc xóa dữ liệu cũ.
- `npm run test:reviews`: **70 kiểm tra đạt**, bao gồm vé đã soát và suất đã kết thúc, các trạng thái không đủ điều kiện, điểm/nhận xét hợp lệ, chống gửi trùng đồng thời, trung bình và số lượt, dữ liệu cá nhân, phân trang, chặn admin/nhân viên và khóa ngoại bảo vệ đánh giá.
- `npm run test:checkin`: **10 kiểm tra đạt**. `npm run test:smoke`: **46 kiểm tra đạt** với Gemini đã cấu hình; kiểm tra hồi quy đặt vé, ghế trùng, hủy vé, CRUD và phân quyền.
- `npm run test:ai`: **43 kiểm tra đạt**, thêm xác minh AI phân biệt phim chưa có đánh giá với điểm trung bình khách hàng, và nhận số lượt đánh giá trong danh mục công khai.
- `npm run check`: **146 tệp JavaScript/JSX** đạt kiểm tra cú pháp/import. Build Worker + trình duyệt thành công, có hai API mới `/api/movies/:id/reviews` và `/api/reviews/me`.
- Edge: khách đăng nhập, xem phim chưa đánh giá, chọn điểm bằng bàn phím, lỗi gửi vẫn giữ bản nháp, gửi thành công và chuyển sang Đã đánh giá. Tải lại trang vẫn giữ lịch sử. Khách thứ hai gửi từ popup chi tiết, điểm 8 và 6 cho trung bình 7; chỉ lịch sử của chính tài khoản được hiển thị. Khách chưa đăng nhập đọc được nhận xét công khai.
- Popup lấy điểm mới khi danh mục trong trình duyệt đã cũ; sau khi gửi, focus vẫn ở trong popup. Giao diện biểu mẫu và nhận xét không tràn ngang ở 320/390px. Form admin không có ô sửa điểm và không gửi trường điểm/số lượt trong payload cập nhật.

Các kiểm tra dùng dữ liệu riêng và dọn sạch theo ID sau khi hoàn tất; không thêm nhận xét giả vào phim thật của ứng dụng.

## Thành viên, điểm thưởng và quản lý tài khoản

Cập nhật quyền nhân viên: **122 kiểm tra thành viên đạt**, bao gồm tra cứu mã, khách không được xem danh sách mã của người khác, nhân viên giao combo, lưu `fulfilled_by` và chống xác nhận trùng khi nhân viên/admin cùng thao tác. Đã chạy giao diện Edge cho nhân viên: vào Quà thành viên, tìm mã, xác nhận giao combo, hiển thị Đã nhận quà; không xuất hiện menu Tài khoản/Tổng quan và không có lỗi JavaScript. Dữ liệu QA được dọn sau kiểm tra.

`npm run test:membership`: **118 kiểm tra đạt** trên CSDL D1 local. Bao gồm xác thực ngày sinh (ngày không có thật, tương lai, 29/2), múi giờ Việt Nam, cửa sổ sinh nhật ±10 ngày và giao năm, lưu ngày sinh đúng một lần, quyền admin thêm/sửa/xóa tài khoản, thu hồi phiên khi đổi email/mật khẩu, điểm và hạng, đổi quà, xác nhận giao quà, dùng vé thưởng và giữ đánh giá khi xóa tài khoản.

Các tình huống đồng thời đã kiểm tra: ghi ngày sinh lần đầu, soát cùng vé, tiêu cùng số điểm, đổi quà khi số dư chỉ đủ một món, dùng cùng ưu đãi sinh nhật hoặc vé thưởng, hủy vé và hoàn điểm. Giao dịch lỗi do ghế đã bị giữ không trừ điểm hay mất ưu đãi. Thanh toán được tính lại trên server, không tin số tiền/điểm do client gửi.

Kiểm tra Edge bằng `.sites-runtime/check-membership-ui.mjs` đạt: đăng ký bắt buộc ngày sinh, banner sinh nhật, thẻ/hạng/điểm, đổi quà, thanh toán bằng điểm/sinh nhật/vé thưởng, admin thêm/sửa ngày sinh/xóa tài khoản/giao quà, tài khoản cũ bổ sung ngày sinh một lần. Không có lỗi JavaScript trong các luồng đã chạy; màn hình thành viên và thanh toán không tràn ngang ở 320px và 390px. Ảnh chụp nằm tại `.sites-runtime/membership-*.png` và `.sites-runtime/member-checkout-*.png`.

Các tài khoản, điểm và giao dịch QA đều được tạo riêng rồi dọn theo ID. Không tăng điểm cho khách hàng thật để trình diễn. Build Worker và kiểm tra 156 tệp JavaScript/JSX đạt; kiểm tra hồi quy 46 tình huống API tổng quát, 70 tình huống đánh giá phim, 10 tình huống soát vé và 43 tình huống AI đạt.

## Báo cáo quản trị theo thời gian

`npm run test:analytics`: **50 kiểm tra đạt**. Phạm vi: ranh giới giờ Việt Nam, năm/tháng/ngày, tháng nhuận và giao năm, đối chiếu cùng thời lượng cho tháng đang diễn ra, giữ ngày dư của kỳ trước, đối chiếu tổng doanh thu/vé/đơn với từng biểu đồ, đơn hủy và vé miễn phí, BXH chi tiêu và điểm hiện tại, phân quyền admin cho báo cáo/Excel/AI, từ chối chỉnh tiền/số ghế và dữ liệu tài chính giả gửi cho Gemini. Dữ liệu khách bị xóa vẫn đóng góp doanh thu lịch sử nhưng không nằm trong BXH tài khoản hoạt động.

**14 kiểm tra Edge đạt** qua `.sites-runtime/check-analytics-ui.mjs`: năm mặc định, sáu biểu đồ và bảy khu vực phân tích, bộ lọc tháng/ngày, BXH, Excel tải từ trình duyệt, xóa nhận xét cũ khi đổi kỳ, năm không có dữ liệu, không tràn ngang ở 390px/320px và không có lỗi JavaScript. Đã gọi Gemini thật thành công (`mode=gemini`) cho cả bảy mục. Tệp Excel được đọc như ZIP và toàn bộ thành phần XML hợp lệ; có bảy worksheet và ô số chứa đúng giá trị được lọc. Fixture thử nghiệm được dọn theo ID.

Kiểm tra cú pháp/import **166 tệp JavaScript/JSX**, build Worker và 118 kiểm tra thành viên đạt sau thay đổi. Ảnh kiểm tra lưu tại `.sites-runtime/analytics-desktop.png`, `analytics-gemini.png`, `analytics-mobile.png`; file thử Excel là `analytics-test.xlsx` và `analytics-browser.xlsx` trong cùng thư mục được bỏ qua khỏi Git.

## Quyền sửa ngày sinh, cộng điểm và nhật ký bất biến

`npm run test:audit`: **44 kiểm tra đạt**. Nhân viên tìm khách và chỉ sửa ngày sinh với lý do; chặn dữ liệu giả, ngày tương lai/ngày không có thật, sửa tài khoản staff/admin và ghi đè đồng thời. Chỉ admin cộng điểm; gửi lại cùng mã yêu cầu không cộng trùng, nhiều khoản độc lập không mất cập nhật, điểm thưởng không tăng hạng. Nhật ký ghi đúng người thực hiện trong các yêu cầu đồng thời, số dư/ngày sinh trước–sau, lý do và thay đổi danh mục. Không có mật khẩu, hash hoặc token trong log. UPDATE, DELETE và INSERT OR REPLACE nhắm tới log hiện có đều bị CSDL từ chối; API chỉ cho đọc.

Edge qua `.sites-runtime/check-member-audit-ui.mjs` đạt: nhân viên sửa ngày sinh, admin cộng điểm và tra nhật ký/tìm lý do, xem dữ liệu trước–sau, không có nút xóa/sửa log. Hai giao diện không tràn ngang ở 320px/390px, không có lỗi JavaScript. Hồi quy 122 kiểm tra thành viên, 70 đánh giá phim và 50 báo cáo đều đạt; cú pháp/import 175 tệp JavaScript/JSX đạt. Tài khoản QA được dọn; log QA được giữ nguyên theo tính bất biến.

## Các kiểm tra trước đó

| Nhóm | Kết quả |
| --- | --- |
| JavaScript/JSX toàn dự án | `npm run check` kiểm tra cú pháp và import nội bộ đạt |
| Build Worker + trình duyệt | `node scripts/run-framework.mjs build` đạt |
| API nghiệp vụ | 47 kiểm tra đạt qua `scripts/smoke-test.mjs` |
| Soát vé, thay đổi lịch và số liệu | 10 kiểm tra bổ sung đạt qua `scripts/test-checkin.mjs` |
| Giao diện khách hàng trên Edge | 21 kiểm tra đạt |
| Giao diện admin/nhân viên trên Edge | 18 kiểm tra đạt |
| Desktop và mobile | Không tràn ngang; không có lỗi JavaScript trong các luồng đã kiểm tra |
| Khởi tạo CSDL | Chạy lần đầu thành công; lần hai không chạy lại migration đã áp dụng |

Kiểm tra nghiệp vụ bao gồm phân quyền ba vai trò, bảo vệ vé riêng, tính giá từ server dù gửi giá giả, hai yêu cầu đặt trùng ghế đồng thời, rollback không để đơn mồ côi, hủy và đặt lại ghế, soát vé hợp lệ và chống sử dụng lần hai, ràng buộc khóa ngoại, chặn lịch chồng lấn, cập nhật số liệu từ đơn thực tế.

Kiểm tra trình duyệt bao gồm tìm/lọc/xem phim, đăng nhập rồi tiếp tục đặt vé, chọn ghế, combo, WELCOME10, thanh toán giả lập, vé điện tử và lịch sử, hủy vé, AI demo và từ chối câu hỏi ngoài phạm vi, thêm/sửa/xóa combo qua form admin, điều hướng các trang quản lý, menu mobile và nhân viên phát hành vé tại quầy.

Các dữ liệu riêng tạo cho kiểm tra API đã được dọn theo ID của lần chạy; vé tạo qua giao diện đã hủy bằng API nghiệp vụ bình thường. Số liệu doanh thu ban đầu là 0 vì chưa có đơn đang hiệu lực.

**Giới hạn kiểm tra ban đầu:** lần kiểm tra đầu tiên chưa gọi Gemini thật vì chưa có API key. Trong các lần cập nhật sau đã kiểm tra kết nối Gemini thật, câu hỏi theo tâm trạng và ngữ cảnh hội thoại. Bộ `npm run test:ai` chạy độc lập với Google để kiểm tra tham chiếu dữ liệu và giới hạn hội thoại. Thanh toán chỉ mô phỏng theo phạm vi đồ án.

Ảnh chụp local nằm trong thư mục `outputs/` và được loại khỏi Git/deployment. Bản dev đã khởi động lại sau khi hoàn tất các tệp để làm sạch trạng thái HMR; phản hồi trang chính hiện là HTTP 200.
