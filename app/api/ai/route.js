import { answerCatalogQuestion } from "@/lib/server/ai";
import { AI_MESSAGE_LIMIT, validChatHistory } from "@/lib/ai-chat";
import { api, HttpError, jsonBody } from "@/lib/server/http";
export const POST = api(async (request) => {
    const body = await jsonBody(request);
    if (typeof body.message !== "string" || !body.message.trim() || body.message.length > AI_MESSAGE_LIMIT) {
        throw new HttpError(400, `Vui lòng nhập câu hỏi từ 1 đến ${AI_MESSAGE_LIMIT} ký tự.`);
    }
    const history = body.history ?? [];
    if (!validChatHistory(history))
        throw new HttpError(400, "Lịch sử trò chuyện không hợp lệ. Vui lòng tải lại trang.");
    return Response.json(await answerCatalogQuestion(body.message.trim(), history), {
        headers: { "Cache-Control": "no-store" },
    });
});
