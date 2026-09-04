'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { reportIssue, type ReportState } from '@/lib/actions/report';

/**
 * A small "something is broken" button, present on every page.
 *
 * Sits at the bottom of the page rather than floating over it: a fixed
 * overlay would cover content on the short screens this app is built for,
 * and this is not something people need in a hurry.
 */
export default function ReportIssueButton() {
  const t = useTranslations('issue');
  const tc = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState('');
  const [state, formAction, pending] = useActionState<ReportState, FormData>(reportIssue, {});

  // Captured automatically - people say "the button didn't work" without
  // saying where, and the location is what makes the report actionable.
  useEffect(() => {
    setPath(window.location.pathname + window.location.search);
  }, []);

  if (state.done) {
    return (
      <p className="mt-6 rounded-lg border border-brand bg-surface p-3 text-center text-sm font-semibold text-brand">
        {t('thanks')}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 min-h-12 self-center text-sm text-muted underline"
      >
        {t('button')}
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-6 rounded-xl border border-border bg-surface p-4">
      <input type="hidden" name="pagePath" value={path} />

      <h2 className="text-sm font-bold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted">{t('hint')}</p>

      {state.error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-danger">
          {t(state.error)}
        </p>
      )}

      <label className="sr-only" htmlFor="issue-body">
        {t('title')}
      </label>
      <textarea
        id="issue-body"
        name="body"
        rows={3}
        maxLength={1000}
        required
        placeholder={t('placeholder')}
        className="mt-2 w-full rounded-lg border border-border bg-bg p-2 text-sm"
      />

      <label className="mt-2 block text-sm font-semibold" htmlFor="issue-contact">
        {t('contact')}
      </label>
      <input
        id="issue-contact"
        name="contact"
        maxLength={120}
        placeholder={t('contactPlaceholder')}
        className="mt-1 min-h-12 w-full rounded-lg border border-border bg-bg px-3 text-sm"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="min-h-12 flex-1 rounded-lg bg-brand font-bold text-brand-contrast disabled:opacity-60"
        >
          {pending ? tc('sending') : t('send')}
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
