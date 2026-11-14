import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "espree";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const excluded = new Set(["node_modules", ".tools", ".git", ".next", ".vinext", ".wrangler", ".sites-runtime", ".agents", ".codex", "dist", "out", "outputs", "work", "public", "vendor"]);
const extensions = [".js", ".jsx", ".mjs", ".cjs", ".json", ".css"];
function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (excluded.has(entry.name)) return [];
    const full = resolve(dir, entry.name);
    return entry.isDirectory() ? files(full) : [full];
  });
}
let checked = 0;
const errors = [];
for (const file of files(root)) {
  // Vinext generates this ignored framework declaration even for JavaScript apps.
  if (file === resolve(root, "next-env.d.ts")) continue;
  if (/\.(ts|tsx|mts|cts)$/.test(file)) {
    errors.push(`${relative(root, file)}: TypeScript source remains`);
    continue;
  }
  if (!/\.(js|jsx|mjs|cjs)$/.test(file)) continue;
  try {
    const ast = parse(readFileSync(file, "utf8"), { ecmaVersion: "latest", sourceType: file.endsWith(".cjs") ? "commonjs" : "module", ecmaFeatures: { jsx: true } });
    for (const node of ast.body) {
      const name = node.source?.value;
      if (typeof name !== "string" || (!name.startsWith(".") && !name.startsWith("@/"))) continue;
      const target = name.startsWith("@/") ? resolve(root, name.slice(2)) : resolve(dirname(file), name);
      const candidates = extname(target) ? [target] : extensions.flatMap(extension => [target + extension, resolve(target, "index" + extension)]);
      if (!candidates.some(existsSync)) errors.push(`${relative(root, file)}: missing import ${name}`);
    }
    checked++;
  } catch (error) {
    errors.push(`${relative(root, file)}: ${error.message}`);
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else console.log(`PASS JavaScript/JSX syntax and local imports in ${checked} files; no TypeScript source remains.`);
