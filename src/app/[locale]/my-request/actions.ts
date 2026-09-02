'use server';

import { revalidatePath } from 'next/cache';
import { closeOwnRequest, renewOwnRequest } from '@/lib/requests';
import { clearSession, getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export type ManageState = { done?: 'closed' | 'renewed'; error?: boolean };

export async function manageOwnRequest(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const locale = String(formData.get('locale') ?? 'ar');
  const requestId = Number(formData.get('requestId') ?? 0);
  const intent = String(formData.get('intent') ?? '');

  const session = await getSession();
  if (!session || !requestId) return { error: true };

  const ok =
    intent === 'close'
      ? await closeOwnRequest(requestId, session.personId)
      : await renewOwnRequest(requestId, session.personId);

  if (!ok) return { error: true };

  revalidatePath(`/${locale}/my-request`);
  return { done: intent === 'close' ? 'closed' : 'renewed' };
}

/**
 * Sign out of this device.
 *
 * Verification is remembered for 30 days, which is right for the person's own
 * phone and wrong for a borrowed one. This gives them a way to end it.
 */
export async function signOutAction(formData: FormData): Promise<void> {
  const locale = String(formData.get('locale') ?? 'ar');
  await clearSession();
  redirect(`/${locale}`);
}
