'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { claimAction, type ClaimState } from '@/app/[locale]/needs/[id]/actions';

export default function ClaimButton({
  locale,
  requestId,
  claimHours,
  maxPerTrip,
}: {
  locale: string;
  requestId: number;
  claimHours: number;
  maxPerTrip: number;
}) {
  const t = useTranslations('detail');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<ClaimState, FormData>(claimAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="requestId" value={requestId} />

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-surface p-3 text-sm font-semibold text-danger"
        >
          {t(state.error, { max: maxPerTrip })}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-14 rounded-xl bg-brand px-5 text-lg font-bold text-brand-contrast disabled:opacity-60"
      >
        {pending ? tc('loading') : t('claim')}
      </button>

      <p className="text-sm text-muted">{t('claimHint', { hours: claimHours })}</p>
    </form>
  );
}
