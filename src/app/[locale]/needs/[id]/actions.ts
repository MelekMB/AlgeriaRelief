'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { claimRequest } from '@/lib/claims';
import { logReveal } from '@/lib/requests';
import { getSession } from '@/lib/session';

export type ClaimState = { error?: string };

export async function claimAction(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const locale = String(formData.get('locale') ?? 'ar');
  const requestId = Number(formData.get('requestId') ?? 0);
  if (!requestId) return { error: 'notFound' };

  const session = await getSession();
  if (!session) redirect(`/${locale}/signin?next=/needs/${requestId}`);

  const result = await claimRequest(requestId, session.personId);

  if (!result.ok) {
    const map: Record<string, string> = {
      not_verified: 'needVerify',
      suspended: 'suspended',
      already_claimed: 'alreadyClaimed',
      not_found: 'notFound',
      trip_full: 'tripFull',
      different_wilaya: 'differentWilaya',
      own_request: 'ownRequest',
      daily_cap: 'dailyCap',
      home_needs_verify: 'homeNeedsVerify',
    };
    return { error: map[result.reason] ?? 'notFound' };
  }

  // Claiming IS the reveal, so it is logged as one.
  const h = await headers();
  await logReveal(requestId, session.personId, {
    ip: h.get('x-forwarded-for') ?? undefined,
    userAgent: h.get('user-agent') ?? undefined,
  });

  redirect(`/${locale}/trip`);
}
