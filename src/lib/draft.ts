import { cookies } from 'next/headers';
import { decrypt, encrypt } from './crypto';

/**
 * A request in progress, held between "submit" and "OTP verified".
 *
 * Encrypted rather than merely signed, because the draft carries a home
 * address. It is short-lived and cleared the moment the request is created.
 */
export type RequestDraft = {
  categoryCode: string;
  communeId: number;
  body: string;
  urgency: 'normal' | 'high' | 'critical';
  beneficiary: 'self' | 'family' | 'neighbour';
  deliveryPoint: 'home' | 'landmark';
  address?: string;
  landmarkHint?: string;
  phoneE164: string;
};

const COOKIE = 'ar_draft';
const MAX_AGE_SECONDS = 30 * 60;

export async function setDraft(draft: RequestDraft): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, encrypt(JSON.stringify(draft)), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getDraft(): Promise<RequestDraft | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decrypt(raw)) as RequestDraft;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
