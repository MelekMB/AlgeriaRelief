'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { confirmAction, type ConfirmState } from '@/app/[locale]/trip/actions';

export default function ConfirmDeliveryForm({
  locale,
  requestId,
}: {
  locale: string;
  requestId: number;
}) {
  const t = useTranslations('trip');
  const tc = useTranslations('common');
  const [state, formAction, pending] = useActionState<ConfirmState, FormData>(confirmAction, {});

  if (state.done) {
    return (
      <p className="rounded-lg border border-brand bg-surface p-3 text-sm font-bold text-brand">
        {t('confirmed')}
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3 border-t border-border pt-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="requestId" value={requestId} />

      <h3 className="text-sm font-bold">{t('confirmTitle')}</h3>
      <p className="mt-1 text-sm text-muted">{t('confirmHint')}</p>

      {state.error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {t('wrongCode')}
        </p>
      )}

      <div className="mt-2 flex gap-2">
        <label className="sr-only" htmlFor={`code-${requestId}`}>
          {t('confirmCode')}
        </label>
        <input
          id={`code-${requestId}`}
          name="code"
          inputMode="numeric"
          maxLength={4}
          required
          className="min-h-12 w-28 rounded-lg border border-border bg-bg px-3 text-center font-mono text-xl tracking-widest"
        />
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-lg bg-brand font-bold text-brand-contrast disabled:opacity-60"
        >
          {pending ? tc('loading') : t('confirm')}
        </button>
      </div>
    </form>
  );
}
