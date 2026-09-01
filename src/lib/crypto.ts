import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  randomInt,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';

// Keys are derived lazily. Deriving at module load would make `next build`
// fail before secrets are configured, which is a confusing first-run error
// on a fresh Replit import.
let keys: { enc: Buffer; mac: Buffer } | null = null;

function getKeys() {
  if (keys) return keys;

  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set and at least 32 characters. Generate one with: openssl rand -hex 32',
    );
  }

  // Separate keys for separate jobs — never reuse one key across purposes.
  keys = {
    enc: scryptSync(secret, 'algeria-relief:enc:v1', 32),
    mac: scryptSync(secret, 'algeria-relief:mac:v1', 32),
  };
  return keys;
}

const encKeyOf = () => getKeys().enc;
const macKeyOf = () => getKeys().mac;

/* ------------------------------------------------------------------ */
/* Hashing — used for phone lookup and OTP comparison.                 */
/* Peppered with the app secret so a database leak alone does not      */
/* allow a rainbow-table attack over a 9-digit number space.           */
/* ------------------------------------------------------------------ */

export function hashToken(value: string): string {
  return createHmac('sha256', macKeyOf()).update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/* ------------------------------------------------------------------ */
/* Symmetric encryption — phone numbers and addresses at rest.         */
/* AES-256-GCM. Format: v1.<iv>.<tag>.<ciphertext>, all base64url.     */
/* ------------------------------------------------------------------ */

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKeyOf(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ct.toString('base64url')].join(
    '.',
  );
}

export function decrypt(payload: string): string {
  const [version, ivB64, tagB64, ctB64] = payload.split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || !ctB64) {
    throw new Error('Malformed ciphertext');
  }
  const decipher = createDecipheriv('aes-256-gcm', encKeyOf(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/* ------------------------------------------------------------------ */
/* Signed values — session cookies.                                    */
/* ------------------------------------------------------------------ */

export function sign(value: string): string {
  const mac = createHmac('sha256', macKeyOf()).update(value).digest('base64url');
  return `${Buffer.from(value, 'utf8').toString('base64url')}.${mac}`;
}

export function unsign(signed: string): string | null {
  const [payloadB64, mac] = signed.split('.');
  if (!payloadB64 || !mac) return null;
  const value = Buffer.from(payloadB64, 'base64url').toString('utf8');
  const expected = createHmac('sha256', macKeyOf()).update(value).digest('base64url');
  return safeEqual(mac, expected) ? value : null;
}

/* ------------------------------------------------------------------ */
/* Codes                                                               */
/* ------------------------------------------------------------------ */

/** Numeric codes only — they are read aloud over a bad phone line. */
export function numericCode(digits: number): string {
  let out = '';
  for (let i = 0; i < digits; i++) out += randomInt(0, 10).toString();
  return out;
}
