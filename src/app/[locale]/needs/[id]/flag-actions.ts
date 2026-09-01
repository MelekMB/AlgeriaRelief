'use server';

import { redirect } from 'next/navigation';
import { flagRequest } from '@/lib/flags';
import { getSession } from '@/lib/session';

export type FlagState = {
  done?: boolean;
  quarantined?: boolean;
  error?: 'needVerify' | 'already';
};

export async function flagAction(_prev: FlagState, formData: FormData): Promise<FlagState> {
  const locale = String(formData.get('locale') ?? 'ar');
  const requestId = Number(formData.get('requestId') ?? 0);
  const reason = String(formData.get('reason') ?? '').trim();

  const session = await getSession();
  // Flagging requires a verified number, otherwise the weighting means
  // nothing and anyone could bury a real request from a fresh browser.
  if (!session) redirect(`/${locale}/signin?next=/needs/${requestId}`);

  const result = await flagRequest(requestId, session.personId, reason);

  if (!result.ok) {
    return { error: result.reason === 'already_flagged' ? 'already' : 'needVerify' };
  }

  return { done: true, quarantined: result.quarantined };
}
