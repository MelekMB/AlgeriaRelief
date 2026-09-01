'use server';

import { revalidatePath } from 'next/cache';
import { confirmDelivery } from '@/lib/claims';
import { getSession } from '@/lib/session';

export type ConfirmState = { error?: string; done?: boolean };

export async function confirmAction(
  _prev: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const locale = String(formData.get('locale') ?? 'ar');
  const requestId = Number(formData.get('requestId') ?? 0);
  const code = String(formData.get('code') ?? '');

  const session = await getSession();
  if (!session) return { error: 'wrongCode' };

  const result = await confirmDelivery(requestId, session.personId, code);
  if (!result.ok) return { error: 'wrongCode' };

  revalidatePath(`/${locale}/trip`);
  return { done: true };
}
