'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { manageOwnRequest, type ManageState } from '@/app/[locale]/my-request/actions';

export default function ManageRequestForm({
  locale,
  requestId,
}: {
  locale: string;
  requestId: number;
}) {
  const t = useTranslations('myRequest');
  const [state, formAction, pending] = useActionState<ManageState, FormData>(
    manageOwnRequest,
    {},
  );

  if (state.done) {
    return (
      <p className="rounded-lg border border-brand bg-surface p-3 text-sm font-bold text-brand">
        {state.done === 'closed' ? t('closed') : t('renewed')}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="requestId" value={requestId} />

      {/* Closing is the primary action: a met need left open sends the next
          donor on a wasted trip. */}
      <button
        type="submit"
        name="intent"
        value="close"
        disabled={pending}
        className="min-h-14 rounded-xl bg-brand text-lg font-bold text-brand-contrast disabled:opacity-60"
      >
        {t('close')}
      </button>
      <p className="text-sm text-muted">{t('closeHint')}</p>

      <button
        type="submit"
        name="intent"
        value="renew"
        disabled={pending}
        className="min-h-12 rounded-xl border-2 border-brand font-bold text-brand disabled:opacity-60"
      >
        {t('renew')}
      </button>
      <p className="text-sm text-muted">{t('renewHint')}</p>
    </form>
  );
}
