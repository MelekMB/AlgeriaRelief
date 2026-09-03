import { NextResponse } from 'next/server';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { otpCodes } from '@/db/schema';
import { hashToken } from '@/lib/crypto';
import { upsertPerson } from '@/lib/people';
import {
  extractCode,
  parseInbound,
  verifySignature,
  whatsappConfig,
} from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CODE_LENGTH = 6;

/**
 * Meta's webhook handshake. It calls this once with a challenge and expects
 * the challenge echoed back, but only if our verify token matches.
 */
export async function GET(request: Request) {
  const config = whatsappConfig();
  if (!config) return new NextResponse('Not configured', { status: 404 });

  const params = new URL(request.url).searchParams;

  if (
    params.get('hub.mode') === 'subscribe' &&
    params.get('hub.verify_token') === config.verifyToken
  ) {
    return new NextResponse(params.get('hub.challenge') ?? '', { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * Inbound messages. A message whose text contains a live code, sent FROM the
 * number that code was issued to, verifies that number.
 *
 * Both halves must match. A code alone is not enough: without binding it to
 * the sender, anyone who guessed a code could verify someone else's number.
 */
export async function POST(request: Request) {
  const config = whatsappConfig();
  if (!config) return new NextResponse('Not configured', { status: 404 });

  const raw = await request.text();

  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'))) {
    console.warn('[whatsapp] rejected a callback with a bad or missing signature');
    return new NextResponse('Forbidden', { status: 403 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }

  for (const message of parseInbound(payload)) {
    const code = extractCode(message.text, CODE_LENGTH);
    if (!code) continue;

    const e164 = `+${message.from}`;
    const phoneHash = hashToken(e164);

    const [row] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.phoneHash, phoneHash),
          eq(otpCodes.codeHash, hashToken(code)),
          isNull(otpCodes.consumedAt),
          gt(otpCodes.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    if (!row) {
      // Wrong code, expired, or sent from a different number than the one
      // typed into the form. Nothing to tell the sender - replying would cost
      // money and this is the free path.
      console.warn('[whatsapp] no live code matched this sender');
      continue;
    }

    await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));
    await upsertPerson(e164, { verified: true });

    console.log('[whatsapp] verified a number');
  }

  // Always 200: Meta retries on anything else, and a retry storm helps nobody.
  return NextResponse.json({ received: true });
}
