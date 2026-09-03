import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { hashToken, numericCode, safeEqual } from './crypto';
import { upsertPerson } from './people';
import { parseAlgerianMobile } from './phone';
import { isDevEchoMode, sendSms } from './sms';

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

// Rate limits. One number is one identity, so these caps are also the
// cheapest defence against bulk fake posting.
const MAX_SENDS_PER_HOUR = 5;
const MIN_SECONDS_BETWEEN_SENDS = 60;

export type RequestOtpResult =
  | { ok: true; devCode?: string }
  | {
      ok: false;
      reason: 'invalid_phone' | 'too_soon' | 'too_many' | 'send_failed';
      retryAfterSeconds?: number;
    };

export async function requestOtp(phoneInput: string): Promise<RequestOtpResult> {
  const parsed = parseAlgerianMobile(phoneInput);
  if (!parsed.ok) return { ok: false, reason: 'invalid_phone' };

  const phoneHash = hashToken(parsed.e164);
  const now = new Date();

  const [recent] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.phoneHash, phoneHash))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (recent) {
    const elapsed = (now.getTime() - recent.createdAt.getTime()) / 1000;
    if (elapsed < MIN_SECONDS_BETWEEN_SENDS) {
      return {
        ok: false,
        reason: 'too_soon',
        retryAfterSeconds: Math.ceil(MIN_SECONDS_BETWEEN_SENDS - elapsed),
      };
    }
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phoneHash, phoneHash),
        gt(otpCodes.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
      ),
    );

  if (count >= MAX_SENDS_PER_HOUR) return { ok: false, reason: 'too_many' };

  const code = numericCode(CODE_LENGTH);

  await db.insert(otpCodes).values({
    phoneHash,
    codeHash: hashToken(code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
  });

  const sent = await sendSms(parsed.e164, `${code}`);
  if (!sent.ok) {
    console.error('[otp] SMS send failed:', sent.error);
    return { ok: false, reason: 'send_failed' };
  }

  // Only ever surfaced when there is no SMS provider and we are not in
  // production — otherwise this would hand an attacker every code.
  return isDevEchoMode() ? { ok: true, devCode: code } : { ok: true };
}

export type VerifyOtpResult =
  | { ok: true; personId: number }
  | { ok: false; reason: 'invalid_phone' | 'no_code' | 'expired' | 'wrong_code' | 'too_many' };

export async function verifyOtp(phoneInput: string, code: string): Promise<VerifyOtpResult> {
  const parsed = parseAlgerianMobile(phoneInput);
  if (!parsed.ok) return { ok: false, reason: 'invalid_phone' };

  const phoneHash = hashToken(parsed.e164);

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phoneHash, phoneHash), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!row) return { ok: false, reason: 'no_code' };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  if (!safeEqual(hashToken(code.trim()), row.codeHash)) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpCodes.id, row.id));
    return { ok: false, reason: 'wrong_code' };
  }

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));

  const personId = await upsertPerson(parsed.e164, { verified: true });
  return { ok: true, personId };
}

/**
 * Creates a code WITHOUT sending anything.
 *
 * Used by the WhatsApp flow, where the user delivers the code to us rather
 * than the other way round - which is what makes it free.
 */
export async function issueCodeOnly(
  phoneInput: string,
): Promise<{ ok: true; code: string; e164: string } | { ok: false; reason: 'invalid_phone' | 'too_soon' | 'too_many' }> {
  const parsed = parseAlgerianMobile(phoneInput);
  if (!parsed.ok) return { ok: false, reason: 'invalid_phone' };

  const phoneHash = hashToken(parsed.e164);
  const now = new Date();

  const [recent] = await db
    .select({ createdAt: otpCodes.createdAt })
    .from(otpCodes)
    .where(eq(otpCodes.phoneHash, phoneHash))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (recent && (now.getTime() - recent.createdAt.getTime()) / 1000 < MIN_SECONDS_BETWEEN_SENDS) {
    return { ok: false, reason: 'too_soon' };
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.phoneHash, phoneHash),
        gt(otpCodes.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
      ),
    );

  if (count >= MAX_SENDS_PER_HOUR) return { ok: false, reason: 'too_many' };

  const code = numericCode(CODE_LENGTH);

  await db.insert(otpCodes).values({
    phoneHash,
    codeHash: hashToken(code),
    expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
  });

  // Create the person up front, still unverified. Approval - whether from the
  // webhook or by hand - then only has to flip a flag, and no plaintext
  // number needs storing anywhere extra.
  await upsertPerson(parsed.e164, { verified: false });

  return { ok: true, code, e164: parsed.e164 };
}

/**
 * Has the code we issued in this browser been delivered to us over WhatsApp?
 *
 * Checked against the exact code AND number, so a poller cannot claim someone
 * else's verification by guessing.
 */
export async function isCodeConsumed(e164: string, code: string): Promise<boolean> {
  const [row] = await db
    .select({ consumedAt: otpCodes.consumedAt })
    .from(otpCodes)
    .where(and(eq(otpCodes.phoneHash, hashToken(e164)), eq(otpCodes.codeHash, hashToken(code))))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  return Boolean(row?.consumedAt);
}
