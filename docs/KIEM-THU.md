# Kết quả kiểm tra — 09/10/2026

| Nhóm | Kết quả |
| --- | --- |
| TypeScript toàn dự án | `tsc --noEmit` đạt |
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

**Giới hạn kiểm tra:** chưa gọi Gemini thật vì không có API key của người dùng. Luồng Demo và kiểm tra schema/ID của kết quả Gemini đã triển khai; cần key hợp lệ để xác nhận kết nối API thực tế. Thanh toán chỉ mô phỏng theo phạm vi đồ án.

Ảnh chụp local nằm trong thư mục `outputs/` và được loại khỏi Git/deployment. Bản dev đã khởi động lại sau khi hoàn tất các tệp để làm sạch trạng thái HMR; phản hồi trang chính hiện là HTTP 200.
