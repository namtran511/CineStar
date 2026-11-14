import './policies.css';
export const metadata = { title: 'Điều khoản và chính sách · CineStar' };

export default function Policies() {
  return <main className="policy-page">
    <a href="/">← Về CineStar</a>
    <header className="policy-intro">
      <p>THÔNG TIN DÀNH CHO KHÁCH HÀNG</p>
      <h1>Điều khoản và chính sách CineStar</h1>
      <p>Các nội dung dưới đây mô tả cách website CineStar hiện vận hành. Vui lòng đọc trước khi đăng ký tài khoản hoặc đặt vé.</p>
      <nav aria-label="Các mục chính sách"><a href="#terms">Điều khoản sử dụng</a><a href="#privacy">Bảo mật thông tin</a><a href="#payment">Thanh toán &amp; hoàn hủy vé</a><a href="#cinema-rules">Nội quy rạp phim</a><a href="/policies/notifications">Thông báo qua email</a></nav>
    </header>
    <section id="terms" className="policy-section">
      <h2>1. Điều khoản sử dụng</h2>
      <h3>1.1. Phạm vi áp dụng</h3>
      <p>Điều khoản này áp dụng cho việc tạo tài khoản, xem thông tin phim, chọn suất chiếu, giữ ghế, đặt vé, sử dụng ưu đãi và tra cứu vé trên website CineStar. Website hỗ trợ chuyển khoản VietQR qua SePay; các hình thức khác tùy theo cấu hình và kênh bán vé.</p>
      <h3>1.2. Tài khoản và thông tin đăng ký</h3>
      <ul><li>Khách cung cấp họ tên, địa chỉ email có thể nhận mã xác minh, mật khẩu và ngày sinh chính xác. Tài khoản chỉ được tạo sau khi nhập đúng mã xác minh gửi tới email.</li><li>Khách chịu trách nhiệm giữ kín mật khẩu, mã xác minh và bảo vệ quyền truy cập email của mình. Không chia sẻ hoặc dùng tài khoản của người khác để đặt vé.</li><li>Ngày sinh được dùng để xác định quyền lợi sinh nhật và không thể tự sửa sau khi đăng ký. Nếu nhập sai, liên hệ nhân viên hoặc quản trị viên để được xem xét cập nhật.</li><li>Không dùng website để đặt ghế tự động hàng loạt, gian lận ưu đãi, can thiệp dữ liệu hoặc làm gián đoạn dịch vụ của người khác.</li></ul>
      <h3>1.3. Thông tin phim, giá và vé</h3>
      <ul><li>Khách cần kiểm tra phim, phân loại độ tuổi, ngày giờ, phòng, ghế, combo và tổng giá trị đơn trước khi xác nhận. Giá và ưu đãi áp dụng là thông tin hiển thị tại thời điểm đặt vé.</li><li>Ghế được giữ tạm thời trong quá trình đặt; hết thời hạn giữ mà chưa hoàn tất thì ghế có thể được người khác chọn. Vé chỉ xuất hiện trong tài khoản sau khi hệ thống ghi nhận đơn thành công.</li><li>Mã vé gắn với một đơn cụ thể. Khách xuất trình mã vé còn hiệu lực khi soát vé; mã của đơn đã hủy hoặc đã sử dụng không thể dùng lại.</li><li>Ưu đãi, điểm thành viên và vé thưởng áp dụng theo điều kiện hiển thị trên website; không phải mọi ưu đãi đều được cộng dồn trong cùng một đơn.</li></ul>
      <h3>1.4. Thay đổi suất chiếu và sự cố</h3>
      <p>Thông báo sự cố gửi qua email nhằm cung cấp thông tin cho khách có vé của suất chiếu bị ảnh hưởng. Việc chỉ gửi thông báo không tự hủy vé, đổi suất hay hoàn tiền. Nếu quản trị viên chọn xóa lịch chiếu vì sự cố, hệ thống gỡ suất đó khỏi lịch đặt vé, hủy các đơn liên quan và gửi email hủy vé; lịch sử đơn vẫn được lưu để khách tra cứu. Khách cần kiểm tra trạng thái vé trên website và làm theo hướng dẫn trong thông báo.</p>
      <h3>1.5. Hỗ trợ</h3>
      <p>Nếu không nhận được mã xác minh, phát hiện thông tin đơn không đúng hoặc cần hỗ trợ tài khoản, vui lòng dùng thông tin liên hệ hiển thị ở chân trang website. Khi liên hệ về vé, hãy cung cấp mã vé và email tài khoản; không gửi mật khẩu hoặc mã xác minh cho bất kỳ ai.</p>
    </section>
    <section id="privacy" className="policy-section">
      <h2>2. Chính sách bảo mật thông tin</h2>
      <h3>2.1. Thông tin được xử lý</h3>
      <p>Website xử lý họ tên, email, ngày sinh, mật khẩu dưới dạng băm, thông tin tài khoản và phiên đăng nhập. Khi dùng dịch vụ, hệ thống còn ghi nhận đơn vé, phim, suất chiếu, ghế, combo, điểm thành viên, ưu đãi đã dùng và lựa chọn nhận email. Địa chỉ IP có thể được dùng để giới hạn số lần yêu cầu mã xác minh, chống lạm dụng.</p>
      <h3>2.2. Mục đích sử dụng</h3>
      <ul><li>Xác minh email, đăng nhập và bảo vệ tài khoản.</li><li>Ghi nhận đơn, giữ ghế, soát vé, xử lý hủy vé và quyền lợi thành viên.</li><li>Gửi mã xác minh, thông báo liên quan đến vé hoặc sự cố, cùng email ưu đãi và sinh nhật theo <a href="/policies/notifications">Chính sách thông báo qua email</a>.</li><li>Vận hành trang quản trị, hỗ trợ khách hàng và hạn chế việc sử dụng sai chức năng.</li></ul>
      <h3>2.3. Lưu trữ và bảo vệ</h3>
      <p>Dữ liệu vận hành được lưu trong cơ sở dữ liệu Cloudflare D1. Mật khẩu không được lưu dưới dạng có thể đọc trực tiếp; mã xác minh có thời hạn và không được lưu dưới dạng mã gốc. Hệ thống dùng phiên đăng nhập và giới hạn quyền của khách, nhân viên, quản trị viên để kiểm soát truy cập. Không có hệ thống nào bảo đảm an toàn tuyệt đối, vì vậy khách cũng cần bảo vệ thiết bị và email cá nhân.</p>
      <h3>2.4. Dịch vụ bên ngoài</h3>
      <p>Để gửi email, địa chỉ người nhận và nội dung thông báo được chuyển cho Resend. Cloudflare cung cấp hạ tầng vận hành website và cơ sở dữ liệu. Khi chuyển khoản VietQR, SePay gửi dữ liệu giao dịch cần thiết về website để xác nhận đơn và đối soát. Website không yêu cầu nhập số thẻ ngân hàng hoặc mã CVV.</p>
      <h3>2.5. Kiểm soát thông tin của bạn</h3>
      <p>Khách có thể xem thông tin tài khoản, vé và một số quyền lợi trong website. Email ưu đãi và sinh nhật có liên kết ngừng nhận; việc ngừng nhận không ảnh hưởng đến email mã xác minh và thông báo vé. Nếu muốn sửa thông tin không thể tự thay đổi, hỏi về dữ liệu đã cung cấp hoặc yêu cầu hỗ trợ tài khoản, vui lòng liên hệ qua thông tin hỗ trợ ở chân trang. Website hiện không cung cấp nút tự xóa toàn bộ dữ liệu tài khoản.</p>
    </section>
    <section id="payment" className="policy-section">
      <h2>3. Chính sách thanh toán và hoàn hủy vé</h2>
      <h3>3.1. Phương thức thanh toán hiện tại</h3>
      <p>Trên website vận hành thật, khách thanh toán bằng chuyển khoản VietQR qua SePay. Hệ thống chỉ phát hành vé khi nhận được xác nhận giao dịch hợp lệ và khớp mã đơn, số tiền, tài khoản nhận. Đơn chờ thanh toán có thời hạn; hết hạn mà chưa được xác nhận thì ghế được mở lại. Tại quầy, nhân viên có thể ghi nhận thanh toán tiền mặt sau khi đã thu tiền. Môi trường phát triển có thể dùng thanh toán giả lập để thử chức năng, không áp dụng cho giao dịch thật.</p>
      <h3>3.2. Xác nhận đơn</h3>
      <p>Trước khi đặt, khách kiểm tra tổng giá trị đơn sau ưu đãi, ghế và suất chiếu. Khi hệ thống ghi nhận thành công, đơn và mã vé hiển thị trong “Vé của tôi”; email xác nhận được gửi đến địa chỉ đã xác minh. Nếu không thấy email, hãy kiểm tra cả thư rác và trạng thái đơn trên website trước khi đặt lại.</p>
      <h3>3.3. Ai được hủy và hạn chót</h3>
      <ul><li>Khách đăng nhập chỉ được tự hủy đơn của chính mình khi vé còn hiệu lực, chưa soát và còn ít nhất 60 phút trước giờ chiếu.</li><li>Quản trị viên được hủy đơn còn hiệu lực, chưa soát khi còn ít nhất 30 phút trước giờ chiếu. Khi suất chiếu gặp sự cố, quản trị viên có thể hủy đồng loạt các đơn đã thanh toán, đã soát hoặc đang chờ thanh toán của suất đó trong khi suất chiếu chưa kết thúc. Nhân viên không có quyền hủy đơn.</li><li>Không thể hủy lại đơn đã hủy. Một thao tác hủy áp dụng cho toàn bộ ghế trong đơn; hiện không hỗ trợ hủy riêng từng ghế hoặc tự đổi sang suất chiếu khác.</li></ul>
      <h3>3.4. Vé hoàn nhận được sau khi hủy</h3>
      <p>Khi hủy thành công, mã vé cũ hết hiệu lực và ghế được mở lại. Tài khoản khách nhận một vé xem phim miễn phí cho mỗi ghế đã hủy, kể cả đơn thanh toán qua SePay, dù thao tác hủy do khách hay quản trị viên thực hiện. Ví dụ, hủy đơn 2 ghế sẽ nhận 2 vé dùng lại. Vé hoàn xuất hiện trong mục Thẻ thành viên và dùng như vé thưởng đổi bằng điểm: mỗi vé miễn phí giá của một ghế ở đơn mới, không bao gồm combo. Có thể dùng nhiều vé thưởng trong cùng một đơn, tối đa bằng số ghế đã chọn và số vé thưởng đang có; không cộng dồn với mã ưu đãi, điểm hoặc ưu đãi sinh nhật.</p>
      <p>Nếu đơn cũ đã sử dụng vé thưởng, từng vé đó được khôi phục và được tính trong số vé nhận lại, không cấp thêm vé trùng. Điểm thành viên đã dùng được trả lại; quyền dùng ưu đãi sinh nhật đã áp dụng cho đơn được khôi phục. Các vé hoàn không tự đổi thành tiền mặt hay trừ vào giá combo. Chính sách cấp vé này áp dụng cho các lần hủy thực hiện sau khi tính năng được triển khai, không tự cấp bù cho đơn đã hủy trước đó.</p>
      <h3>3.5. Thanh toán và sự cố</h3>
      <p>Với việc hủy vé theo điều kiện ở mục 3.3, hệ thống hoàn bằng vé miễn phí theo mục 3.4, không hoàn bằng tiền qua ngân hàng, kể cả đơn đã thanh toán qua SePay. Nếu có trường hợp pháp luật yêu cầu hoàn tiền hoặc rạp không cung cấp được dịch vụ đã cam kết, khách liên hệ rạp để được xử lý riêng; việc cấp vé không làm mất quyền theo pháp luật. Các đơn SePay đã được ghi nhận chờ hoàn tiền trước khi chính sách này được áp dụng vẫn được rạp xử lý theo trạng thái đã ghi nhận. Email thông báo sự cố không tự hủy đơn hoặc cấp vé hoàn; quyền lợi chỉ phát sinh khi đơn thực sự chuyển sang trạng thái “Vé đã hủy”.</p>
    </section>
    <section id="cinema-rules" className="policy-section">
      <h2>4. Nội quy rạp phim</h2>
      <p>Những hướng dẫn dưới đây dành cho khách sử dụng vé CineStar khi dịch vụ chiếu phim tại rạp được triển khai. Vui lòng tuân theo hướng dẫn của nhân viên tại địa điểm chiếu.</p>
      <h3>4.1. Vé và vào phòng chiếu</h3>
      <ul><li>Kiểm tra phim, suất chiếu, phòng và ghế trước khi đến rạp; đến sớm để có thời gian soát vé và ổn định chỗ ngồi.</li><li>Xuất trình mã vé còn hiệu lực khi được yêu cầu. Mỗi ghế cần có vé phù hợp; không dùng vé đã hủy hoặc đã soát để vào lại khi chưa được nhân viên hỗ trợ.</li><li>Ngồi đúng ghế trên vé và giữ lối đi thông thoáng. Nếu có nhầm ghế hoặc gặp khó khăn khi vào phòng chiếu, hãy nhờ nhân viên hỗ trợ.</li></ul>
      <h3>4.2. Độ tuổi xem phim</h3>
      <p>Khách cần xem ký hiệu phân loại của từng phim trước khi đặt vé: P dành cho mọi lứa tuổi; K dành cho người dưới 13 tuổi khi có người giám hộ đi cùng; T13, T16 và T18 lần lượt yêu cầu người xem từ đủ 13, 16 và 18 tuổi. Phim phân loại C không được phổ biến. Người xem phim có giới hạn tuổi nên chuẩn bị giấy tờ phù hợp để đối chiếu khi cần. Nhân viên có thể từ chối cho vào phòng chiếu nếu không đáp ứng độ tuổi của phim.</p>
      <h3>4.3. Trong phòng chiếu</h3>
      <ul><li>Không quay phim, ghi âm, chụp màn hình hoặc phát trực tiếp nội dung phim khi chưa được phép.</li><li>Đặt điện thoại ở chế độ im lặng, giảm sáng màn hình, hạn chế trò chuyện và không gây ảnh hưởng đến người xem khác.</li><li>Không hút thuốc, sử dụng thuốc lá điện tử, rượu bia hoặc chất kích thích trong phòng chiếu; giữ vệ sinh và bỏ rác đúng nơi quy định.</li><li>Bảo quản đồ dùng cá nhân và tôn trọng tài sản, thiết bị của rạp. Khi có sự cố hoặc yêu cầu sơ tán, làm theo hướng dẫn của nhân viên.</li></ul>
      <h3>4.4. Đồ ăn, vật dụng và hỗ trợ</h3>
      <p>Vui lòng tuân theo hướng dẫn tại rạp về đồ ăn, thức uống và vật dụng được mang vào phòng chiếu. Không mang vật nguy hiểm hoặc đồ có thể làm phiền người xem khác. Nếu cần hỗ trợ tiếp cận, có trẻ nhỏ đi cùng hoặc có nhu cầu đặc biệt, hãy liên hệ nhân viên trước suất chiếu để được hướng dẫn.</p>
    </section>
  </main>;
}
