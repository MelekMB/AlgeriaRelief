'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { flagAction, type FlagState } from '@/app/[locale]/needs/[id]/flag-actions';

export default function FlagButton({
  locale,
  requestId,
}: {
  locale: string;
  requestId: number;
}) {
  const t = useTranslations('flag');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FlagState, FormData>(flagAction, {});

  if (state.done) {
    return (
      <p className="rounded-lg border border-border bg-surface p-3 text-sm">
        {state.quarantined ? t('quarantined') : t('done')}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-12 self-start text-sm text-muted underline"
      >
        {t('button')}
      </button>
    );
  }

  return (
    <form action={formAction} className="rounded-xl border border-border bg-surface p-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="requestId" value={requestId} />

      <h2 className="text-sm font-bold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted">{t('hint')}</p>

      {state.error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {t(state.error)}
        </p>
      )}

      <label className="sr-only" htmlFor="reason">
        {t('title')}
      </label>
      <textarea
        id="reason"
        name="reason"
        rows={2}
        maxLength={500}
        placeholder={t('reasonPlaceholder')}
        className="mt-2 w-full rounded-lg border border-border bg-bg p-2 text-sm"
        required
      />

      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-lg border-2 border-danger font-bold text-danger disabled:opacity-60"
        >
          {pending ? tc('sending') : t('submit')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-12 px-4 text-sm text-muted"
        >
          {tc('cancel')}
        </button>
      </div>
    </form>
  );
}
