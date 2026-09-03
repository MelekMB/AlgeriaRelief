import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * WhatsApp verification, the free way round.
 *
 * We never SEND a WhatsApp message. Outbound authentication templates are
 * billed per message per country; incoming messages are free at any volume.
 * So the direction is flipped: the app shows a code, the user taps a button
 * that opens WhatsApp with that code pre-filled to our business number, and
 * they press send. The webhook below receives it.
 *
 * That gives us two things at once, for nothing:
 *   - proof the person controls the number, because the message arrives FROM
 *     that number
 *   - no dependency on carrier SMS delivery to +213, which is the single
 *     biggest unknown in this project
 *
 * It is also less work for the user: one tap instead of copying digits
 * between two apps.
 */

export type WhatsAppConfig = {
  /** The business number people message, in E.164 without the leading +. */
  businessNumber: string;
  /** Shared string echoed back during Meta's webhook handshake. */
  verifyToken: string;
  /** App secret, used to check that callbacks really came from Meta. */
  appSecret?: string;
};

export function whatsappConfig(): WhatsAppConfig | null {
  const businessNumber = (process.env.WHATSAPP_BUSINESS_NUMBER ?? '').replace(/\D/g, '');
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN ?? '';

  if (!businessNumber || !verifyToken) return null;

  return {
    businessNumber,
    verifyToken,
    appSecret: process.env.WHATSAPP_APP_SECRET || undefined,
  };
}

export function whatsappConfigured(): boolean {
  return whatsappConfig() !== null;
}

/**
 * The link that opens WhatsApp with the code already typed.
 * Works on phone and desktop, and needs no app install beyond WhatsApp itself.
 */
export function whatsappVerifyLink(code: string): string | null {
  const config = whatsappConfig();
  if (!config) return null;

  const text = encodeURIComponent(`${code}`);
  return `https://wa.me/${config.businessNumber}?text=${text}`;
}

/**
 * Meta signs every callback. Without checking it, anyone who guesses the URL
 * could mark arbitrary numbers as verified simply by POSTing to it.
 */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const config = whatsappConfig();
  if (!config?.appSecret) {
    // No secret configured means we cannot prove the caller is Meta. Refuse
    // rather than trust it: a forged callback would defeat verification.
    return false;
  }

  if (!header?.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', config.appSecret).update(rawBody).digest('hex');
  const received = header.slice('sha256='.length);

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(received, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export type InboundMessage = { from: string; text: string };

/** Pulls the sender and body out of Meta's webhook envelope. */
export function parseInbound(payload: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const body = payload as {
    entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
  };

  for (const entry of body?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const message of change.value?.messages ?? []) {
        const from = String(message.from ?? '').replace(/\D/g, '');
        const text = String(
          (message.text as { body?: string } | undefined)?.body ?? '',
        ).trim();
        if (from && text) out.push({ from, text });
      }
    }
  }

  return out;
}

/** Codes are read out of a free-text message, so pull the first digit run. */
export function extractCode(text: string, length: number): string | null {
  const match = text.match(new RegExp(`\\b\\d{${length}}\\b`));
  return match ? match[0] : null;
}

/**
 * Approve a code by hand.
 *
 * A stop-gap for running before the Meta webhook exists: the operator reads
 * the code out of their own WhatsApp and types it in. It does exactly what
 * the webhook does - consume the code and verify the number it was issued to
 * - so switching to the automated path later changes nothing for users.
 *
 * Only reachable from the password-protected admin page.
 */
export async function approveCodeManually(
  code: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
  const { and, desc, eq, gt, isNull } = await import('drizzle-orm');
  const { db } = await import('@/db');
  const { otpCodes } = await import('@/db/schema');
  const { hashToken } = await import('./crypto');
  const { markVerifiedByPhoneHash } = await import('./people');

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(
      and(
        eq(otpCodes.codeHash, hashToken(code.trim())),
        isNull(otpCodes.consumedAt),
        gt(otpCodes.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!row) return { ok: false, reason: 'not_found' };

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
  await markVerifiedByPhoneHash(row.phoneHash);

  return { ok: true };
}
