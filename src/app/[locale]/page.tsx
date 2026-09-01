import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import EmergencyBanner from '@/components/EmergencyBanner';
import LanguageToggle from '@/components/LanguageToggle';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('home');
  const tf = await getTranslations('footer');

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

      <footer className="mt-auto flex gap-4 pt-4 text-sm text-muted">
        <Link href="/abuse">{tf('abuse')}</Link>
        <Link href="/privacy">{tf('privacy')}</Link>
      </footer>
    </main>
  );
}
