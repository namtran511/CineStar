import { logoutResponse } from "@/lib/server/auth";
import { api } from "@/lib/server/http";
export const POST = api(logoutResponse);
