'use server';

import { redirect } from 'next/navigation';
import { clearDraft, getDraft } from '@/lib/draft';
import { requestOtp, verifyOtp } from '@/lib/otp';
import { createRequest, hasOpenRequest } from '@/lib/requests';
import { dedupeFingerprint, screenText } from '@/lib/screening';
import { setSession } from '@/lib/session';

export type VerifyState = { error?: string; devCode?: string };

export async function verifyAndCreate(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const locale = String(formData.get('locale') ?? 'ar');
  const code = String(formData.get('code') ?? '').trim();

  const draft = await getDraft();
  if (!draft) redirect(`/${locale}/request/new`);

  const result = await verifyOtp(draft.phoneE164, code);
  if (!result.ok) {
    const map: Record<string, string> = {
      wrong_code: 'wrong',
      expired: 'expired',
      no_code: 'noCode',
      too_many: 'tooMany',
      invalid_phone: 'wrong',
    };
    return { error: map[result.reason] ?? 'wrong' };
  }

  await setSession(result.personId);

  if (await hasOpenRequest(result.personId)) {
    await clearDraft();
    redirect(`/${locale}/request/sent?duplicate=1`);
  }

  // Re-screen at creation time. The draft cookie lives on the client, so its
  // contents are never trusted on the way back in.
  const verdict = screenText(
    [draft.body, draft.address, draft.landmarkHint].filter(Boolean).join(' \n '),
  );
  if (verdict.action === 'block') {
    await clearDraft();
    return { error: 'wrong' };
  }

  const created = await createRequest({
    personId: result.personId,
    categoryCode: draft.categoryCode,
    communeId: draft.communeId,
    body: draft.body,
    urgency: draft.urgency,
    beneficiary: draft.beneficiary,
    deliveryPoint: draft.deliveryPoint,
    address: draft.address,
    landmarkHint: draft.landmarkHint,
    screeningScore: verdict.score,
    screeningReason: verdict.reasons.join(','),
    dedupeFingerprint: dedupeFingerprint({
      body: draft.body,
      communeId: draft.communeId,
      categoryKey: draft.categoryCode,
    }),
    shadowed: verdict.action === 'shadow',
  });

  await clearDraft();
  if (!created) return { error: 'wrong' };

  redirect(`/${locale}/request/sent?ref=${created.manageCode}&door=${created.confirmCode}`);
}

export async function resendCode(): Promise<VerifyState> {
  const draft = await getDraft();
  if (!draft) return { error: 'noCode' };

  const otp = await requestOtp(draft.phoneE164);
  if (!otp.ok) return { error: otp.reason === 'too_many' ? 'tooMany' : 'noCode' };
  return { devCode: otp.devCode };
}
