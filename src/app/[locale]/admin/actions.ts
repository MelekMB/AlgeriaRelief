'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLog, requests } from '@/db/schema';
import { safeEqual, sign, unsign } from '@/lib/crypto';
import { KEYS, setSetting } from '@/lib/settings';

const ADMIN_COOKIE = 'ar_admin';

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  return Boolean(raw && unsign(raw) === 'admin');
}

export type AdminState = { error?: boolean; saved?: boolean };

export async function loginAction(_prev: AdminState, formData: FormData): Promise<AdminState> {
  const password = String(formData.get('password') ?? '');
  const expected = process.env.ADMIN_PASSWORD ?? '';

  // No password configured means no admin access at all — never an open door.
  if (!expected || password.length !== expected.length || !safeEqual(password, expected)) {
    return { error: true };
  }

  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sign('admin'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return { saved: true };
}

/** Plain server action: these are progressive-enhancement forms, not useActionState. */
export async function settingsAction(formData: FormData): Promise<void> {
  if (!(await isAdmin())) return;

  const locale = String(formData.get('locale') ?? 'ar');
  const intent = String(formData.get('intent') ?? '');

  if (intent === 'readonly') {
    const next = String(formData.get('value') ?? '0');
    await setSetting(KEYS.readOnly, next === '1' ? '1' : '0');
    await db.insert(auditLog).values({
      actor: 'admin',
      action: next === '1' ? 'read_only_on' : 'read_only_off',
    });
  }

  if (intent === 'throttle') {
    const codes = String(formData.get('wilayas') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(',');
    await setSetting(KEYS.throttledWilayas, codes);
    await db.insert(auditLog).values({
      actor: 'admin',
      action: 'set_throttle',
      metadata: codes,
    });
  }

  if (intent === 'keep' || intent === 'remove') {
    const requestId = Number(formData.get('requestId') ?? 0);
    if (requestId) {
      await db
        .update(requests)
        .set({ status: intent === 'keep' ? 'open' : 'removed' })
        .where(eq(requests.id, requestId));
      await db.insert(auditLog).values({
        actor: 'admin',
        action: intent === 'keep' ? 'restore' : 'remove',
        targetType: 'request',
        targetId: requestId,
      });
    }
  }

  revalidatePath(`/${locale}/admin`);
}
