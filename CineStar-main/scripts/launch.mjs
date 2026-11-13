import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const childEnv = { ...process.env, PATH: `${dirname(process.execPath)}${process.platform === "win32" ? ";" : ":"}${process.env.PATH || ""}` };
function run(args) { return new Promise((resolve, reject) => { const child = spawn(process.execPath, args, { cwd: root, env: childEnv, stdio: "inherit" }); child.on("error", reject); child.on("exit", code => code === 0 ? resolve() : reject(new Error(`Lệnh thất bại (${code}): ${args.join(" ")}`))); }); }
if (!existsSync("node_modules/vinext")) { console.error("Hãy cài thư viện trước: npm ci"); process.exit(1); }
await run(["scripts/init-db.mjs"]);
console.log("\nCineStar: mở http://localhost:5173 trong trình duyệt. Nhấn Ctrl+C để dừng.\n");
await run(["scripts/run-framework.mjs", "dev"]);
