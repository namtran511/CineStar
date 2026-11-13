// HTTP delivery works in Cloudflare Workers; credentials never reach the browser.
export function emailConfiguration(env) {
    const missing = [];
    if (!env.RESEND_API_KEY) missing.push('RESEND_API_KEY');
    if (!env.EMAIL_FROM || /[\r\n]/.test(env.EMAIL_FROM)) missing.push('EMAIL_FROM');
    if (String(env.EMAIL_CODE_SECRET || '').length < 32) missing.push('EMAIL_CODE_SECRET');
    try { const url = new URL(env.APP_URL); if (url.protocol !== 'https:' && !(env.APP_ENV !== 'production' && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw new Error(); }
    catch { missing.push('APP_URL'); }
    return { configured: missing.length === 0, missing };
}
export async function deliverEmail(env, payload, key, fetcher = fetch) {
    if (!emailConfiguration(env).configured) throw new Error('email_not_configured');
    let response;
    try {
        response = await fetcher('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
            body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
        });
    } catch { throw new Error('email_network_error'); }
    // Never log the provider response: it may contain recipient information.
    if (!response.ok) throw new Error(`email_provider_${response.status}`);
    const result = await response.json();
    if (!result.id) throw new Error('email_invalid_response');
    return result.id;
}
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
export function emailPayload(env, to, subject, text, unsubscribe) {
    const url = new URL('/', env.APP_URL).href;
    const footer = `\n\nCineStar · ${url}${env.CINEMA_EMAIL ? `\nHỗ trợ: ${env.CINEMA_EMAIL}` : ''}`;
    const full = text + footer + (unsubscribe ? `\nNgừng nhận email ưu đãi và sinh nhật: ${unsubscribe}` : '');
    return {
        from: env.EMAIL_FROM, to: [to], subject, text: full,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;line-height:1.7;color:#182031"><h2 style="color:#e55c28">CineStar</h2><div style="white-space:pre-wrap">${escapeHtml(text)}</div><hr><p><a href="${escapeHtml(url)}">Mở CineStar</a></p>${env.CINEMA_EMAIL ? `<p>Hỗ trợ: ${escapeHtml(env.CINEMA_EMAIL)}</p>` : ''}${unsubscribe ? `<p><a href="${escapeHtml(unsubscribe)}">Ngừng nhận email ưu đãi và sinh nhật</a></p>` : ''}</div>`,
        ...(unsubscribe ? { headers: { 'List-Unsubscribe': `<${new URL('/api/email/unsubscribe', env.APP_URL).href}?token=${new URL(unsubscribe).searchParams.get('token')}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
    };
}
