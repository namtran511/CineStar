import { api } from "@/lib/server/http";
import { receiveSePayWebhook } from "@/lib/server/payments";
import { getEnv } from "@/lib/server/db";
import { publicPaymentConfiguration } from "@/lib/server/sepay";

export const POST = api(receiveSePayWebhook);
export const GET = api(async () => Response.json({ provider: "sepay", ...publicPaymentConfiguration(getEnv()) }));
