import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';

/**
 * Always labelled in the TARGET language, never a flag icon — flags mean
 * countries, not languages, and get this wrong in the Maghreb specifically.
 */
export default async function LanguageToggle({ locale }: { locale: Locale }) {
  const t = await getTranslations('common');
  const other: Locale = locale === 'ar' ? 'fr' : 'ar';

  return (
    <Link
      href="/"
      locale={other}
      lang={other}
      dir={other === 'ar' ? 'rtl' : 'ltr'}
      className="inline-flex min-h-12 items-center rounded-lg border border-border px-4 py-2 text-sm font-semibold"
    >
      {t('switchTo')}
    </Link>
  );
}
