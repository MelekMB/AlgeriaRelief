'use server';

import { redirect } from 'next/navigation';
import { issueCodeOnly, isCodeConsumed, requestOtp, verifyOtp } from '@/lib/otp';
import { clearPending, getPending, setPending } from '@/lib/pendingVerification';
import { upsertPerson } from '@/lib/people';
import { whatsappConfigured, whatsappVerifyLink } from '@/lib/whatsapp';
import { parseAlgerianMobile } from '@/lib/phone';
import { hashToken } from '@/lib/crypto';
import { findByReference } from '@/lib/requests';
import { smsConfigured } from '@/lib/sms';
import { setSession } from '@/lib/session';

export type SigninState = {
  step: 'phone' | 'code' | 'whatsapp' | 'reference';
  phone?: string;
  error?: string;
  devCode?: string;
  /** Opens WhatsApp with the code pre-filled. */
  whatsappLink?: string;
  code?: string;
};

/**
 * Donor-side phone verification.
 *
 * Separate from the requester flow because a donor has no draft to carry —
 * they arrive from a specific request and must return to it.
 */
export async function signinAction(
  prev: SigninState,
  formData: FormData,
): Promise<SigninState> {
  const locale = String(formData.get('locale') ?? 'ar');
  const next = String(formData.get('next') ?? '/needs');
  const intent = String(formData.get('intent') ?? 'send');

  const canVerify = smsConfigured() || whatsappConfigured();

  // No verification channel at all: the reference code shown when the request
  // was posted is the way back in. Knowing someone's phone number alone must
  // never be enough - otherwise anyone could open a stranger's request, read
  // their door code, or close it on them.
  if (!canVerify) {
    const parsed = parseAlgerianMobile(String(formData.get('phone') ?? ''));
    if (!parsed.ok) return { step: 'reference', error: 'phone' };

    const reference = String(formData.get('reference') ?? '').trim();

    if (reference) {
      // Claiming a request they posted: the code proves it is theirs.
      const personId = await findByReference(hashToken(parsed.e164), reference);
      if (!personId) return { step: 'reference', error: 'notFound' };

      await setSession(personId, 'full');
      const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/my-request';
      redirect(`/${locale}${safeNext}`);
    }

    // Just here to deliver. A phone number is all that is needed to offer
    // help, and this session deliberately cannot open anyone's request.
    const personId = await upsertPerson(parsed.e164, { verified: false });
    await setSession(personId, 'claim');
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/needs';
    redirect(`/${locale}${safeNext}`);
  }

  if (intent === 'send') {
    const parsed = parseAlgerianMobile(String(formData.get('phone') ?? ''));
    if (!parsed.ok) return { step: 'phone', error: 'phone' };

    // Free path: issue a code and let the user send it to us on WhatsApp.
    // We never send a message, so this costs nothing at any volume.
    if (whatsappConfigured()) {
      const issued = await issueCodeOnly(parsed.e164);
      if (!issued.ok) {
        return {
          step: 'phone',
          error: issued.reason === 'too_many' || issued.reason === 'too_soon' ? 'tooMany' : 'phone',
        };
      }
      await setPending({ e164: issued.e164, code: issued.code, next });
      return {
        step: 'whatsapp',
        phone: issued.e164,
        code: issued.code,
        whatsappLink: whatsappVerifyLink(issued.code) ?? undefined,
      };
    }

    const otp = await requestOtp(parsed.e164);
    if (!otp.ok) {
      return {
        step: 'phone',
        error: otp.reason === 'too_many' || otp.reason === 'too_soon' ? 'tooMany' : 'generic',
      };
    }
    return { step: 'code', phone: parsed.e164, devCode: otp.devCode };
  }

  const phone = prev.phone ?? String(formData.get('phone') ?? '');
  const code = String(formData.get('code') ?? '').trim();

  const result = await verifyOtp(phone, code);
  if (!result.ok) {
    const map: Record<string, string> = {
      wrong_code: 'wrong',
      expired: 'expired',
      no_code: 'noCode',
      too_many: 'tooMany',
      invalid_phone: 'phone',
    };
    return { step: 'code', phone, error: map[result.reason] ?? 'wrong' };
  }

  await setSession(result.personId);

  // Only ever redirect to an in-app path — never to an attacker-supplied host.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/needs';
  redirect(`/${locale}${safeNext}`);
}

/**
 * Polled by the WhatsApp screen: has our code reached us yet?
 *
 * Answers only for the code held in THIS browser's encrypted cookie, so it
 * cannot be used to piggyback on someone else's verification.
 */
export async function pollWhatsAppSignin(): Promise<{ verified: boolean; next?: string }> {
  const pending = await getPending();
  if (!pending) return { verified: false };

  if (!(await isCodeConsumed(pending.e164, pending.code))) return { verified: false };

  const personId = await upsertPerson(pending.e164, { verified: true });
  await setSession(personId);
  await clearPending();

  const safeNext =
    pending.next.startsWith('/') && !pending.next.startsWith('//') ? pending.next : '/needs';
  return { verified: true, next: safeNext };
}
