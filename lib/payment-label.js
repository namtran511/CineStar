export const bookingStatusLabels = { pending: "Chờ thanh toán", paid: "Đã thanh toán", checked_in: "Đã soát vé", cancelled: "Đã hủy", expired: "Hết hạn thanh toán" };
export function bookingPaymentLabel(booking) {
    if (booking.paymentProvider === "sepay") return "Chuyển khoản VietQR · SePay";
    if (booking.paymentProvider === "cash") return "Tiền mặt tại quầy";
    if (booking.paymentProvider === "complimentary") return "Vé miễn phí / ưu đãi";
    return "Thanh toán giả lập";
}
