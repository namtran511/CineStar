import { answerCatalogQuestion } from "@/lib/server/ai";
import { api, HttpError, jsonBody } from "@/lib/server/http";

export const POST = api(async (request: Request) => {
  const body = await jsonBody(request);
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 800) {
    throw new HttpError(400, "Vui lòng nhập câu hỏi từ 1 đến 800 ký tự.");
  }
  return Response.json(await answerCatalogQuestion(body.message.trim()), {
    headers: { "Cache-Control": "no-store" },
  });
});
