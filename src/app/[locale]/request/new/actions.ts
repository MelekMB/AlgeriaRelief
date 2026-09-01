'use server';

import { redirect } from 'next/navigation';
import { setDraft, type RequestDraft } from '@/lib/draft';
import { requestOtp } from '@/lib/otp';
import { upsertPerson } from '@/lib/people';
import { parseAlgerianMobile } from '@/lib/phone';
import { createRequest, findDuplicate, hasOpenRequest } from '@/lib/requests';
import { dedupeFingerprint, screenText } from '@/lib/screening';
import { writesBlocked } from '@/lib/settings';

export type SubmitState = {
  error?: string;
  duplicateId?: number;
  devCode?: string;
};

const MAX_BODY = 300;

export async function submitRequest(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const locale = String(formData.get('locale') ?? 'ar');

  const categoryCode = String(formData.get('categoryCode') ?? '').trim();
  const communeId = Number(formData.get('communeId') ?? 0);
  const body = String(formData.get('body') ?? '').trim();
  const urgency = String(formData.get('urgency') ?? 'normal') as RequestDraft['urgency'];
  const beneficiary = String(formData.get('beneficiary') ?? 'self') as RequestDraft['beneficiary'];
  const deliveryPoint = String(
    formData.get('deliveryPoint') ?? 'landmark',
  ) as RequestDraft['deliveryPoint'];
  const address = String(formData.get('address') ?? '').trim();
  const landmarkHint = String(formData.get('landmarkHint') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  // Operator kill switch / per-wilaya throttle. Checked before any work so a
  // spike can be stopped instantly from the dashboard.
  if (await writesBlocked()) return { error: 'generic' };

  if (!categoryCode) return { error: 'category' };
  if (!communeId) return { error: 'commune' };
  if (!body) return { error: 'body' };
  if (body.length > MAX_BODY) return { error: 'bodyTooLong' };
  if (deliveryPoint === 'home' && !address) return { error: 'address' };
  if (deliveryPoint === 'landmark' && !landmarkHint) return { error: 'landmark' };

  const parsedPhone = parseAlgerianMobile(phone);
  if (!parsedPhone.ok) return { error: 'phone' };

  // Screening runs before anything is stored. A payment detail must never
  // reach the database, not even in a draft cookie.
  const verdict = screenText([body, address, landmarkHint].filter(Boolean).join(' \n '));
  if (verdict.action === 'block') return { error: 'blocked' };

  const fingerprint = dedupeFingerprint({ body, communeId, categoryKey: categoryCode });
  const duplicate = await findDuplicate(fingerprint);
  if (duplicate && formData.get('confirmNotDuplicate') !== '1') {
    return { error: 'duplicate', duplicateId: duplicate.id };
  }

  const draft: RequestDraft = {
    categoryCode,
    communeId,
    body,
    urgency,
    beneficiary,
    deliveryPoint,
    address: deliveryPoint === 'home' ? address : undefined,
    landmarkHint: deliveryPoint === 'landmark' ? landmarkHint : undefined,
    phoneE164: parsedPhone.e164,
  };

  await setDraft(draft);

  const otp = await requestOtp(parsedPhone.e164);

  if (!otp.ok) {
    if (otp.reason === 'too_many' || otp.reason === 'too_soon') return { error: 'tooMany' };

    // SMS unavailable. The plan's fallback: publish, but unverified — the
    // post ranks below every verified one and the poster cannot claim or
    // reveal anyone's contact details. Throughput survives; trust is not
    // laundered.
    const personId = await upsertPerson(parsedPhone.e164, { verified: false });
    if (await hasOpenRequest(personId)) return { error: 'alreadyOpen' };

    const created = await createRequest({
      personId,
      categoryCode,
      communeId,
      body,
      urgency,
      beneficiary,
      deliveryPoint,
      address: draft.address,
      landmarkHint: draft.landmarkHint,
      screeningScore: verdict.score,
      screeningReason: verdict.reasons.join(','),
      dedupeFingerprint: fingerprint,
      shadowed: verdict.action === 'shadow',
    });

    if (!created) return { error: 'generic' };
    redirect(`/${locale}/request/sent?unverified=1`);
  }

  redirect(`/${locale}/verify`);
}
