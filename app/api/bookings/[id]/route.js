import { requireUser } from "@/lib/server/auth";
import { getBooking, updateBooking } from "@/lib/server/bookings";
import { api, HttpError, jsonBody } from "@/lib/server/http";
export const GET = api(async (request, context) => {
    const user = await requireUser(request);
    const { id } = await context.params;
    const booking = await getBooking(id);
    if (!booking) throw new HttpError(404, "Đơn vé không tồn tại.");
    if (user.role === "user" && booking.userId !== user.id) throw new HttpError(403, "Bạn không có quyền với đơn vé này.");
    return Response.json({ booking });
});
export const PATCH = api(async (request, context) => {
    const user = await requireUser(request);
    const { id } = await context.params;
    const body = await jsonBody(request);
    if (Object.keys(body).some(key => key !== "action")) throw new HttpError(400, "Không được chỉnh sửa tiền, ghế hoặc số liệu của đơn đã tạo.");
    return Response.json({ booking: await updateBooking(user, id, body.action) });
});
export const DELETE = api(async (request, context) => { const { id } = await context.params; return Response.json({ booking: await updateBooking(await requireUser(request), id, "cancel") }); });
