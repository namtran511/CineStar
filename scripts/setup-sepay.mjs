import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Bank details are public payment destinations. Secrets stay in ignored local
// configuration and are sent to Wrangler through stdin, never command arguments.
const config = JSON.parse(readFileSync("cloudflare.production.json", "utf8"));
const path = ".dev.vars";
let content = existsSync(path) ? readFileSync(path, "utf8") : "";
function add(key, value) {
    const pattern = new RegExp(`^${key}=([^\\r\\n]*)`, "m");
    const current = content.match(pattern);
    if (current && !["", '""', "''"].includes(current[1].trim())) return;
    if (current) content = content.replace(pattern, `${key}=${value}`);
    else content += `${content.endsWith("\n") || !content ? "" : "\n"}${key}=${value}\n`;
}
add("PAYMENT_MODE", "sepay");
for (const key of ["SEPAY_BANK", "SEPAY_ACCOUNT_NUMBER", "SEPAY_ACCOUNT_NAME"]) add(key, config.vars[key] || "");
add("SEPAY_WEBHOOK_SECRET", randomBytes(32).toString("hex"));
writeFileSync(path, content, { encoding: "utf8", mode: 0o600 });
if (process.argv.includes("--upload-secret")) {
    const secret = content.match(/^SEPAY_WEBHOOK_SECRET=([^\r\n]+)/m)?.[1].replace(/^["']|["']$/g, "");
    const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "secret", "put", "SEPAY_WEBHOOK_SECRET", "--config", "cloudflare.production.json"], { input: secret + "\n", stdio: ["pipe", "inherit", "inherit"], windowsHide: true });
    if (result.status !== 0) process.exit(result.status || 1);
}
console.log("Prepared SePay configuration in ignored .dev.vars. No secret values were printed. Restart the local server to load it.");
