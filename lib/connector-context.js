import { AsyncLocalStorage } from "node:async_hooks";
// Capture the trusted capability before Vinext derives its revalidation context,
// which does not retain custom execution-context props. Never share across requests.
const bindings = new AsyncLocalStorage();
export function runWithConnectorBinding(binding, run) {
    return bindings.run(binding, run);
}
export function getConnectorBinding() {
    return bindings.getStore();
}
