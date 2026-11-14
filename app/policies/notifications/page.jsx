import '../policies.css';

export const metadata = { title: 'Chính sách thông báo qua email · CineStar' };

export default function NotificationPolicy() {
  return <main className="policy-page">
    <a href="/">← Về CineStar</a>
    <h1>Chính sách thông báo qua email</h1>
    <p>CineStar gửi thông báo đến địa chỉ email của bạn để xác minh tài khoản, cung cấp thông tin về vé và cập nhật các quyền lợi tại rạp. Vui lòng sử dụng email của chính bạn và kiểm tra hộp thư thường xuyên.</p>
    <h2>Các thông báo bạn nhận được</h2>
    <ul>
      <li>Mã xác minh khi đăng ký hoặc xác minh địa chỉ email.</li>
      <li>Xác nhận đặt vé và thông báo hủy vé.</li>
      <li>Thông báo sự cố do rạp gửi cho khách có vé còn hiệu lực của suất chiếu bị ảnh hưởng.</li>
      <li>Thông tin ưu đãi và mã khuyến mãi.</li>
      <li>Lời chúc và thông tin ưu đãi sinh nhật dựa trên ngày sinh đã đăng ký.</li>
    </ul>
    <h2>Xác nhận khi đăng ký</h2>
    <p>Ô đồng ý ở form đăng ký không được chọn sẵn. Khi bạn tích ô này và gửi yêu cầu đăng ký, bạn đồng ý với các chính sách của CineStar và nhận những loại email nêu trên. Email thông báo chỉ được gửi đến tài khoản đã xác minh, trừ email chứa mã xác minh.</p>
    <h2>Ngừng nhận email ưu đãi và sinh nhật</h2>
    <p>Bạn có thể dùng liên kết ngừng nhận ở cuối email ưu đãi hoặc sinh nhật để dừng cả hai loại email này. Việc ngừng nhận không làm mất tài khoản, vé hoặc điểm thành viên. Mã xác minh và thông báo liên quan đến vé, sự cố vẫn được gửi để phục vụ tài khoản và đơn vé của bạn.</p>
    <h2>Phạm vi thông báo</h2>
    <p>Thông báo sự cố không tự hủy vé hoặc đổi suất chiếu. Vui lòng đọc hướng dẫn trong email và kiểm tra trạng thái vé trên website. Email có thể đến chậm hoặc nằm trong mục thư rác tùy dịch vụ hộp thư.</p>
    <p>Xem thêm <a href="/policies">Điều khoản sử dụng, Chính sách bảo mật và Chính sách thanh toán &amp; hoàn hủy vé</a>.</p>
  </main>;
}
