'use server';

import { redirect } from 'next/navigation';
import { requestOtp, verifyOtp } from '@/lib/otp';
import { parseAlgerianMobile } from '@/lib/phone';
import { setSession } from '@/lib/session';

export type SigninState = {
  step: 'phone' | 'code';
  phone?: string;
  error?: string;
  devCode?: string;
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

  if (intent === 'send') {
    const parsed = parseAlgerianMobile(String(formData.get('phone') ?? ''));
    if (!parsed.ok) return { step: 'phone', error: 'phone' };

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
