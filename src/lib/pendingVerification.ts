import { cookies } from 'next/headers';
import { decrypt, encrypt } from './crypto';

/**
 * The code this browser is currently waiting on, held encrypted.
 *
 * The WhatsApp flow polls to ask "has it arrived yet?". That question must be
 * tied to THIS browser: without it, anyone could poll for a number they do
 * not own and be handed a session the moment its owner verified.
 */
export type Pending = { e164: string; code: string; next: string };

const COOKIE = 'ar_pending';
const MAX_AGE_SECONDS = 15 * 60;

export async function setPending(pending: Pending): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, encrypt(JSON.stringify(pending)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getPending(): Promise<Pending | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decrypt(raw)) as Pending;
  } catch {
    return null;
  }
}

export async function clearPending(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
