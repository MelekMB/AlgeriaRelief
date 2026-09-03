'use server';

import { redirect } from 'next/navigation';
import { setDraft, type RequestDraft } from '@/lib/draft';
import { setSession } from '@/lib/session';
import { requestOtp } from '@/lib/otp';
import { upsertPerson } from '@/lib/people';
import { parseAlgerianMobile } from '@/lib/phone';
import { createRequest, findDuplicate, hasOpenRequest } from '@/lib/requests';
import { dedupeFingerprint, screenText } from '@/lib/screening';
import { writesBlocked } from '@/lib/settings';
import { smsConfigured } from '@/lib/sms';

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
  // With no verification channel there is no safe way to hand a stranger a
  // home address, so the app collects landmark meeting points only.
  const requestedDeliveryPoint = String(
    formData.get('deliveryPoint') ?? 'landmark',
  ) as RequestDraft['deliveryPoint'];
  const deliveryPoint: RequestDraft['deliveryPoint'] = smsConfigured()
    ? requestedDeliveryPoint
    : 'landmark';
  const address = String(formData.get('address') ?? '').trim();
  const landmarkHint = String(formData.get('landmarkHint') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();

  // Operator kill switch / per-wilaya throttle. Checked before any work so a
  // spike can be stopped instantly from the dashboard. A settings-table
  // failure must never block posting, so this fails open and says why.
  try {
    if (await writesBlocked()) {
      console.warn('[submitRequest] blocked by operator setting (read-only or throttle)');
      return { error: 'generic' };
    }
  } catch (err) {
    console.error('[submitRequest] settings check failed, continuing anyway:', err);
  }

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

  // Only send a verification SMS to requesters when explicitly switched on.
  //
  // Every message costs money, and verifying the person ASKING for help buys
  // very little: they are the vulnerable side, and their post reveals nothing
  // until a donor claims it. The control that matters is on the DONOR side -
  // seeing someone's address requires a verified phone - and that is
  // unaffected by this. Default off keeps SMS spend proportional to donors,
  // who are far fewer than requests.
  const verifyRequesters = process.env.SMS_VERIFY_REQUESTERS === 'true';

  const otp = verifyRequesters
    ? await requestOtp(parsedPhone.e164)
    : ({ ok: false, reason: 'send_failed' } as const);

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

    // Give the poster a session even though they are unverified. It only ever
    // lets them manage their OWN request; it does not grant verified status,
    // so they still cannot claim anyone else's or see an address. Without it
    // they could never find, renew or close the request they just made -
    // there is no SMS code coming to sign in with.
    await setSession(personId);

    if (!created) {
      console.error(
        `[submitRequest] createRequest returned null — category "${categoryCode}" not found. ` +
          'Has `npm run seed:geo` been run against this database?',
      );
      return { error: 'generic' };
    }
    redirect(`/${locale}/request/sent?unverified=1&ref=${created.manageCode}`);
  }

  redirect(`/${locale}/verify`);
}
