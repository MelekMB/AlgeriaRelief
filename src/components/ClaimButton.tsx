'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { claimAction, type ClaimState } from '@/app/[locale]/needs/[id]/actions';
import { Link } from '@/i18n/routing';

export default function ClaimButton({
  locale,
  requestId,
  claimHours,
  maxPerTrip,
  dailyCap,
}: {
  locale: string;
  requestId: number;
  claimHours: number;
  maxPerTrip: number;
  dailyCap: number;
}) {
  const t = useTranslations('detail');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<ClaimState, FormData>(claimAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="requestId" value={requestId} />

      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-surface p-3 text-sm font-semibold text-danger"
        >
          <p>{t(state.error, { max: maxPerTrip, cap: dailyCap })}</p>

          {/* These two are both "you already have a trip open", so the way
              out is the trip page - where it can be released. */}
          {(state.error === 'differentWilaya' || state.error === 'tripFull') && (
            <Link href="/trip" className="mt-2 inline-block underline">
              {t('seeTrip')}
            </Link>
          )}
        </div>
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
