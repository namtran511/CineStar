import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Prepare ignored local settings without printing credentials or replacing
// existing service settings. This does not make network requests or send mail.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = resolve(root, '.dev.vars');
let content = existsSync(path) ? readFileSync(path, 'utf8') : '';
const added = [];
function add(key, value, fillBlank = false) {
    const pattern = new RegExp(`^${key}=([^\\r\\n]*)`, 'm');
    const current = content.match(pattern);
    if (current && (!fillBlank || !['', '""', "''"].includes(current[1].trim()))) return;
    if (current) content = content.replace(pattern, `${key}=${value}`);
    else content += `${content.endsWith('\n') || !content ? '' : '\n'}${key}=${value}\n`;
    added.push(key);
}
add('RESEND_API_KEY', '');
add('EMAIL_FROM', '');
add('EMAIL_CODE_SECRET', randomBytes(32).toString('hex'), true);
add('APP_URL', 'http://localhost:5173', true);
if (added.length) writeFileSync(path, content, { encoding: 'utf8', mode: 0o600 });
console.log(added.length ? `Prepared local email settings: ${added.join(', ')}.` : 'Local email settings already exist; no values changed.');
console.log('Set RESEND_API_KEY and EMAIL_FROM in .dev.vars, then restart the local server. No credentials were printed.');
