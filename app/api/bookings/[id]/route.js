import { requireUser } from "@/lib/server/auth";
import { updateBooking } from "@/lib/server/bookings";
import { api, HttpError, jsonBody } from "@/lib/server/http";
export const PATCH = api(async (request, context) => {
    const user = await requireUser(request);
    const { id } = await context.params;
    const body = await jsonBody(request);
    if (Object.keys(body).some(key => key !== "action")) throw new HttpError(400, "Không được chỉnh sửa tiền, ghế hoặc số liệu của đơn đã tạo.");
    return Response.json({ booking: await updateBooking(user, id, body.action) });
});
export const DELETE = api(async (request, context) => { const { id } = await context.params; return Response.json({ booking: await updateBooking(await requireUser(request), id, "cancel") }); });
