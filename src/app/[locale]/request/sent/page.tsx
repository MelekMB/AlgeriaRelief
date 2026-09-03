import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import ClearDraft from '@/components/ClearDraft';

export default async function SentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ unverified?: string; ref?: string }>;
}) {
  const { locale } = await params;
  const { unverified, ref } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('sent');
  const th = await getTranslations('home');

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10">
      <ClearDraft />
      <h1 className="text-2xl font-bold text-brand">{t('title')}</h1>
      <p className="text-base">{t('body')}</p>
      <p className="text-sm text-muted">{t('expires')}</p>

      {ref && (
        <div className="rounded-xl border-2 border-brand bg-surface p-4 text-center">
          <p className="text-sm font-semibold">{t('referenceTitle')}</p>
          <p className="mt-1 font-mono text-4xl font-bold tracking-widest text-brand">
            <bdi>{ref}</bdi>
          </p>
          <p className="mt-2 text-sm text-muted">{t('referenceHint')}</p>
        </div>
      )}

      {unverified === '1' && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm">{t('unverified')}</p>
      )}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">{th('safetyTitle')}</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted">
          <li className="font-semibold text-text">{th('safetyNoMoney')}</li>
          <li>{th('safetyVerify')}</li>
        </ul>
      </section>

      <div className="flex flex-col gap-3">
        <Link
          href="/needs"
          className="flex min-h-14 items-center justify-center rounded-xl border-2 border-brand font-bold text-brand"
        >
          {t('viewNeeds')}
        </Link>
        <Link href="/" className="flex min-h-12 items-center justify-center text-sm text-muted">
          {t('home')}
        </Link>
      </div>
    </main>
  );
}
