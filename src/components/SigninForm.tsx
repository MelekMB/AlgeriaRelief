'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { signinAction, type SigninState } from '@/app/[locale]/signin/actions';

export default function SigninForm({ locale, next }: { locale: string; next: string }) {
  const t = useTranslations('form');
  const tv = useTranslations('verify');
  const tc = useTranslations('common');
  const te = useTranslations('formErrors');

  const [state, formAction, pending] = useActionState<SigninState, FormData>(signinAction, {
    step: 'phone',
  });

  const onCodeStep = state.step === 'code';

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="intent" value={onCodeStep ? 'verify' : 'send'} />
      {onCodeStep && <input type="hidden" name="phone" value={state.phone ?? ''} />}

      {state.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-danger-surface p-3 text-sm font-semibold text-danger"
        >
          {onCodeStep ? tv(state.error) : te(state.error)}
        </p>
      )}

      {!onCodeStep ? (
        <>
          <label className="text-sm font-semibold" htmlFor="phone">
            {t('phone')}
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder={t('phonePlaceholder')}
            required
            className="min-h-14 w-full rounded-lg border border-border bg-bg px-3 font-mono text-lg"
          />
          <p className="text-sm text-muted">{t('phoneHint')}</p>
        </>
      ) : (
        <>
          <label className="text-sm font-semibold" htmlFor="code">
            {tv('code')}
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
          {state.devCode && (
            <p className="text-sm text-muted">
              {tv('devNotice')} <bdi className="font-mono font-bold">{state.devCode}</bdi>
            </p>
          )}
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="min-h-14 rounded-xl bg-brand text-lg font-bold text-brand-contrast disabled:opacity-60"
      >
        {pending ? tc('sending') : onCodeStep ? tv('submit') : tc('next')}
      </button>
    </form>
  );
}
