'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { loginAction, type AdminState } from '@/app/[locale]/admin/actions';

export default function AdminLogin() {
  const t = useTranslations('admin');
  const [state, formAction, pending] = useActionState<AdminState, FormData>(loginAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {t('wrong')}
        </p>
      )}
      <label className="text-sm font-semibold" htmlFor="password">
        {t('password')}
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        className="min-h-12 rounded-lg border border-border bg-bg px-3"
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-lg bg-brand font-bold text-brand-contrast disabled:opacity-60"
      >
        {t('login')}
      </button>
    </form>
  );
}
