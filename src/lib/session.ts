import { cookies } from 'next/headers';
import { sign, unsign } from './crypto';

const COOKIE = 'ar_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — "remembered" verification

export type Session = { personId: number; issuedAt: number };

export async function setSession(personId: number): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, sign(JSON.stringify({ personId, issuedAt: Date.now() })), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;

  const value = unsign(raw);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Session;
    if (typeof parsed.personId !== 'number') return null;
    if (Date.now() - parsed.issuedAt > MAX_AGE_SECONDS * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
