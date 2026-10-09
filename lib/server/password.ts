const iterations = 100000;
function toHex(buffer: ArrayBuffer | Uint8Array) { return Array.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer), b => b.toString(16).padStart(2, "0")).join(""); }
function fromHex(hex: string) { return Uint8Array.from(hex.match(/.{2}/g) || [], x => parseInt(x, 16)); }
export async function hashPassword(password: string, salt = toHex(crypto.getRandomValues(new Uint8Array(16)))): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: fromHex(salt), iterations, hash: "SHA-256" }, key, 256);
  return `pbkdf2$${iterations}$${salt}$${toHex(result)}`;
}
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2" || Number(parts[1]) !== iterations) return false;
  const actual = await hashPassword(password, parts[2]);
  let diff = actual.length ^ stored.length;
  for (let i = 0; i < Math.max(actual.length, stored.length); i++) diff |= (actual.charCodeAt(i) || 0) ^ (stored.charCodeAt(i) || 0);
  return diff === 0;
}
export async function hashToken(token: string): Promise<string> { return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))); }
export function randomToken() { return toHex(crypto.getRandomValues(new Uint8Array(32))); }
