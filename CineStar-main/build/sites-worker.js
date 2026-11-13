import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import { runEmailJobs } from '../lib/server/email-jobs';
export default {
    async fetch(request, env, ctx) {
        let binding = ctx.props?.CONNECTORS;
        // Local preview emulates the same request-scoped capability. This branch and
        // the auxiliary service binding are absent from production builds.
        if (import.meta.env.DEV && !binding && env.CONNECTORS) {
            const preview = env.CONNECTORS;
            const expiresAt = Date.now() + 60_000;
            binding = {
                async getContext() {
                    if (Date.now() >= expiresAt)
                        return { status: "request_context_expired" };
                    return preview.getContext?.() ?? { status: "binding_unavailable" };
                },
                async invoke(connectorId, actionName, args) {
                    if (Date.now() >= expiresAt) {
                        return { status: "request_context_expired", message: "This request has expired. Please try again." };
                    }
                    return preview.invoke(connectorId, actionName, args);
                },
            };
        }
        const response = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
        if (request.method !== 'GET' && new URL(request.url).pathname.startsWith('/api/') && response.ok) {
            ctx.waitUntil(runEmailJobs(env,{limit:2}).catch(() => console.error('Email queue processing failed; scheduled retry will follow.')));
        }
        return response;
    },
    async scheduled(_controller, env, ctx) {
        ctx.waitUntil(runEmailJobs(env));
    },
};
