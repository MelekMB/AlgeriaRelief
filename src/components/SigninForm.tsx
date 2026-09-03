'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  pollWhatsAppSignin,
  signinAction,
  type SigninState,
} from '@/app/[locale]/signin/actions';

export default function SigninForm({
  locale,
  next,
  useReference,
}: {
  locale: string;
  next: string;
  useReference: boolean;
}) {
  const t = useTranslations('form');
  const tv = useTranslations('verify');
  const tc = useTranslations('common');
  const te = useTranslations('formErrors');

  const ts = useTranslations('signin');
  const [state, formAction, pending] = useActionState<SigninState, FormData>(signinAction, {
    step: useReference ? 'reference' : 'phone',
  });

  const onCodeStep = state.step === 'code';
  const onWhatsApp = state.step === 'whatsapp';
  const [waiting, setWaiting] = useState(false);

  // Once the code is showing, ask the server every few seconds whether the
  // user's WhatsApp message has reached us. Nothing is sent, so this costs
  // nothing; it just watches for the inbound webhook to land.
  useEffect(() => {
    if (!onWhatsApp) return;
    setWaiting(true);
    let stop = false;

    const tick = async () => {
      if (stop) return;
      try {
        const result = await pollWhatsAppSignin();
        if (result.verified && result.next) {
          window.location.href = `/${locale}${result.next}`;
          return;
        }
      } catch {
        /* transient - keep waiting */
      }
      if (!stop) setTimeout(tick, 3000);
    };

    const timer = setTimeout(tick, 3000);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [onWhatsApp, locale]);

  if (onWhatsApp) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold">{tv('whatsappTitle')}</h2>
        <p className="text-sm text-muted">{tv('whatsappHint')}</p>

        <div className="rounded-xl border-2 border-brand bg-surface p-4 text-center">
          <p className="text-sm font-semibold">{tv('whatsappCode')}</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-brand">
            <bdi>{state.code}</bdi>
          </p>
        </div>

        {state.whatsappLink && (
          <a
            href={state.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 items-center justify-center rounded-xl bg-brand text-lg font-bold text-brand-contrast"
          >
            {tv('whatsappButton')}
          </a>
        )}

        {waiting && (
          <p aria-live="polite" className="text-center text-sm text-muted">
            {tv('whatsappWaiting')}
          </p>
        )}
      </div>
    );
  }

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
          {useReference && state.error === 'notFound'
            ? ts('notFound')
            : onCodeStep
              ? tv(state.error)
              : te(state.error)}
        </p>
      )}

      {useReference ? (
        <>
          <h2 className="text-base font-bold">{ts('deliverTitle')}</h2>
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

          <p className="text-sm text-muted">{ts('deliverHint')}</p>

          {/* Only people who posted a request have this. Donors leave it
              empty and get a session that can deliver but cannot open
              anybody's request. */}
          <div className="mt-2 border-t border-border pt-4">
            <h2 className="text-sm font-bold">{ts('haveRequestTitle')}</h2>
            <label className="mt-2 block text-sm font-semibold" htmlFor="reference">
              {ts('referenceOptional')}
            </label>
            <input
              id="reference"
              name="reference"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              className="mt-1 min-h-14 w-full rounded-lg border border-border bg-bg px-3 text-center font-mono text-2xl tracking-widest"
            />
            <p className="mt-1 text-sm text-muted">{ts('referenceHint')}</p>
          </div>
        </>
      ) : !onCodeStep ? (
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
