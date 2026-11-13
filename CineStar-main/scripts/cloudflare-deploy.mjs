import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const config = JSON.parse(readFileSync('dist/server/wrangler.json', 'utf8'));
const source = JSON.parse(readFileSync('cloudflare.production.json', 'utf8'));
if (existsSync('dist/server/.dev.vars')) throw new Error('Local secrets found in build output. Run npm run build:cloudflare to produce a clean deployment.');
if (config.name !== source.name || config.vars?.APP_ENV !== 'production' || config.d1_databases?.[0]?.database_id !== source.d1_databases[0].database_id) {
    throw new Error('Run npm run build:cloudflare before deploying; the current build is not for this production database.');
}
const result = spawnSync(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'deploy', '--config', 'dist/server/wrangler.json', ...process.argv.slice(2)], {stdio:'inherit'});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
