import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import { deliveryStats } from '@/lib/jobs';
import EmergencyBanner from '@/components/EmergencyBanner';
import LanguageToggle from '@/components/LanguageToggle';

// The ledger is a live figure, so the home page renders per request. It is a
// single aggregate query and it degrades to zeros rather than erroring.
export const dynamic = 'force-dynamic';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const tf = await getTranslations('footer');
  const tl = await getTranslations('ledger');
  const tm = await getTranslations('myRequest');

  // A homepage that 500s during a wildfire is worse than one without numbers.
  const stats = await deliveryStats().catch(() => ({ delivered: 0, open: 0 }));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold leading-tight">{t('title')}</h1>
        <LanguageToggle locale={locale as Locale} />
      </header>

      <EmergencyBanner />

      <p className="text-base text-muted">{t('subtitle')}</p>

      {/* Two doors and nothing else. No hero copy, no carousel. */}
      <nav aria-label={t('title')} className="flex flex-col gap-4">
        <Link
          href="/request/new"
          className="flex min-h-24 flex-col justify-center rounded-2xl bg-brand px-5 py-4 text-brand-contrast"
        >
          <span className="text-xl font-bold">{t('needHelp')}</span>
          <span className="mt-1 text-sm opacity-90">{t('needHelpHint')}</span>
        </Link>

        <Link
          href="/needs"
          className="flex min-h-24 flex-col justify-center rounded-2xl border-2 border-brand px-5 py-4 text-brand"
        >
          <span className="text-xl font-bold">{t('canHelp')}</span>
          <span className="mt-1 text-sm opacity-90">{t('canHelpHint')}</span>
        </Link>
      </nav>

      {/* Confirmed deliveries are the trust signal that recruits the next
          donor — a number nobody can inflate without a real recipient. */}
      {(stats.delivered > 0 || stats.open > 0) && (
        <section aria-label={tl('delivered')} className="flex gap-3">
          <div className="flex-1 rounded-xl border border-border bg-surface p-3 text-center">
            <p className="font-mono text-2xl font-bold text-brand">
              <bdi>{stats.delivered}</bdi>
            </p>
            <p className="text-xs text-muted">{tl('delivered')}</p>
          </div>
          <div className="flex-1 rounded-xl border border-border bg-surface p-3 text-center">
            <p className="font-mono text-2xl font-bold">
              <bdi>{stats.open}</bdi>
            </p>
            <p className="text-xs text-muted">{tl('open')}</p>
          </div>
        </section>
      )}

      <section
        aria-labelledby="safety-title"
        className="rounded-xl border border-border bg-surface p-4"
      >
        <h2 id="safety-title" className="text-sm font-bold">
          {t('safetyTitle')}
        </h2>
        <ul className="mt-2 space-y-2 text-sm text-muted">
          <li className="font-semibold text-text">{t('safetyNoMoney')}</li>
          <li>{t('safetyMeet')}</li>
          <li>{t('safetyVerify')}</li>
        </ul>
      </section>

      <Link
        href="/my-request"
        className="flex min-h-12 items-center justify-center text-sm font-semibold text-brand underline"
      >
        {tm('title')}
      </Link>

      <footer className="mt-auto flex gap-4 pt-4 text-sm text-muted">
        <Link href="/abuse">{tf('abuse')}</Link>
        <Link href="/privacy">{tf('privacy')}</Link>
      </footer>
    </main>
  );
}
