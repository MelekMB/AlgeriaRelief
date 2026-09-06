import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import { deliveryStats } from '@/lib/jobs';
import { smsConfigured } from '@/lib/sms';
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
  const tp = await getTranslations('profile');

  // A homepage that 500s during a wildfire is worse than one without numbers.
  const stats = await deliveryStats().catch(() => ({ delivered: 0, open: 0 }));

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 py-6">
      <header className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold leading-tight">{t('title')}</h1>
        <LanguageToggle locale={locale as Locale} />
      </header>

      {/* One line, not a wall. The full panel is at the foot of the page. */}
      <EmergencyBanner variant="compact" />

      <p className="text-base text-muted">{t('subtitle')}</p>

      {!smsConfigured() && (
        <p className="rounded-xl border border-border bg-surface p-3 text-sm">
          {t('noVerification')}
        </p>
      )}

      {/* Two doors of equal weight. They used to be stacked with the first
          filled and the second outlined, which read as "selected" and "not
          selected" rather than as two equal choices. */}
      <nav aria-label={t('title')} className="grid grid-cols-2 gap-3">
        <Link
          href="/request/new"
          className="flex min-h-28 flex-col justify-center rounded-2xl border-2 border-brand bg-surface px-4 py-4 text-brand"
        >
          <span className="text-lg font-bold leading-tight">{t('needHelp')}</span>
          <span className="mt-1 text-xs text-muted">{t('needHelpHint')}</span>
        </Link>

        <Link
          href="/needs"
          className="flex min-h-28 flex-col justify-center rounded-2xl border-2 border-brand bg-surface px-4 py-4 text-brand"
        >
          <span className="text-lg font-bold leading-tight">{t('canHelp')}</span>
          <span className="mt-1 text-xs text-muted">{t('canHelpHint')}</span>
        </Link>
      </nav>

      {/* Most people arrive from a shared link with no idea what this is or
          how it works. Three steps, in text so it translates and mirrors. */}
      <section aria-labelledby="how-title" className="rounded-xl border border-border p-4">
        <h2 id="how-title" className="text-sm font-bold">
          {t('howItWorks')}
        </h2>
        <ol className="mt-3 flex flex-col gap-3">
          {[t('step1'), t('step2'), t('step3')].map((step, index) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-contrast">
                <bdi>{index + 1}</bdi>
              </span>
              <span className="text-sm leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      </section>

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
        href="/me"
        className="flex min-h-12 items-center justify-center rounded-lg border border-border text-sm font-semibold text-brand"
      >
        {tp('title')}
      </Link>

      {/* The full emergency panel lives here, out of the way of the two
          doors but still on the page. */}
      <EmergencyBanner />

      <footer className="mt-auto flex gap-4 pt-2 text-sm text-muted">
        <Link href="/abuse">{tf('abuse')}</Link>
        <Link href="/privacy">{tf('privacy')}</Link>
      </footer>
    </main>
  );
}
