import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getOwnConfirmCode, getOwnManageCode, getOwnRequest } from '@/lib/requests';
import { getSession } from '@/lib/session';
import ManageRequestForm from '@/components/ManageRequestForm';
import { signOutAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function MyRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/signin?next=/my-request`);

  const t = await getTranslations('myRequest');
  const tc = await getTranslations('common');
  const isAr = locale === 'ar';

  const own = await getOwnRequest(session.personId);

  if (!own) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
            {tc('back')}
          </Link>
        </div>
        <p className="text-muted">{t('none')}</p>
        <Link
          href="/needs"
          className="flex min-h-14 items-center justify-center rounded-xl border-2 border-brand font-bold text-brand"
        >
          {t('browse')}
        </Link>
      </main>
    );
  }

  const code = await getOwnConfirmCode(own.id, session.personId);
  const reference = await getOwnManageCode(own.id, session.personId);

  const statusLabel =
    own.status === 'claimed'
      ? t('statusClaimed')
      : own.status === 'quarantined'
        ? t('statusQuarantined')
        : t('statusOpen');

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>

      <p className="rounded-lg border border-border bg-surface p-3 font-semibold">{statusLabel}</p>

      <div className="rounded-xl border border-border bg-surface p-4">
        <span className="rounded-md bg-brand px-2 py-1 text-xs font-bold text-brand-contrast">
          {isAr ? own.categoryNameAr : own.categoryNameFr}
        </span>
        <p className="mt-2 text-sm">{own.body}</p>
        <p className="mt-2 text-xs text-muted">
          {isAr ? own.communeNameAr : own.communeNameFr} ·{' '}
          {isAr ? own.wilayaNameAr : own.wilayaNameFr}
        </p>
      </div>

      {/* The door code only exists while a donor is actually on the way. */}
      {code && (
        <div className="rounded-xl border-2 border-brand bg-surface p-4 text-center">
          <p className="text-sm font-semibold">{t('yourCode')}</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-widest text-brand">
            <bdi>{code}</bdi>
          </p>
          <p className="mt-2 text-sm text-muted">{t('yourCodeHint')}</p>
        </div>
      )}

      {reference && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm">
          {t('reference')}: <bdi className="font-mono font-bold">{reference}</bdi>
        </p>
      )}

      <ManageRequestForm locale={locale} requestId={own.id} />

      <form action={signOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="min-h-12 text-sm text-muted underline">
          {t('signOut')}
        </button>
      </form>
    </main>
  );
}
