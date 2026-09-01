'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { verifyAndCreate, type VerifyState } from '@/app/[locale]/verify/actions';

export default function VerifyForm({
  locale,
  phoneMasked,
}: {
  locale: string;
  phoneMasked: string;
}) {
  const t = useTranslations('verify');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<VerifyState, FormData>(verifyAndCreate, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <p className="text-sm text-muted">
        {t('sentTo')} <bdi className="font-mono">{phoneMasked}</bdi>
      </p>

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-surface p-3 text-sm font-semibold text-danger"
        >
          {t(state.error)}
        </p>
      )}

      <label className="text-sm font-semibold" htmlFor="code">
        {t('code')}
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        required
        autoFocus
        className="min-h-14 w-full rounded-lg border border-border bg-bg px-3 text-center font-mono text-2xl tracking-widest"
      />

      <button
        type="submit"
        disabled={pending}
        className="min-h-14 rounded-xl bg-brand text-lg font-bold text-brand-contrast disabled:opacity-60"
      >
        {pending ? tc('loading') : t('submit')}
      </button>
    </form>
  );
}
