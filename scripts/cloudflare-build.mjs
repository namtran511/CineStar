import { readFileSync, existsSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const config = JSON.parse(readFileSync('cloudflare.production.json', 'utf8'));
const id = config.d1_databases?.[0]?.database_id;
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '') || id === '00000000-0000-4000-8000-000000000000') {
  throw new Error('Set the real D1 database_id in cloudflare.production.json before building for deployment.');
}
const result = spawnSync(process.execPath, ['scripts/run-framework.mjs', 'build'], {
  stdio: 'inherit', env: { ...process.env, CINESTAR_DEPLOY: '1' },
});
if (result.error) throw result.error;
// The Vite plugin copies local bindings for `wrangler dev`. Production bundles
// must use dashboard secrets and must not retain that local preview file.
if (result.status === 0 && existsSync('dist/server/.dev.vars')) unlinkSync('dist/server/.dev.vars');
process.exit(result.status ?? 1);
