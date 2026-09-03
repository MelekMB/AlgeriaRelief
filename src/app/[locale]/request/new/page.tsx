import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CATEGORIES } from '@/data/categories';
import { FIRE_PRONE_WILAYA_CODES, WILAYAS } from '@/data/wilayas';
import { Link } from '@/i18n/routing';
import EmergencyBanner from '@/components/EmergencyBanner';
import RequestForm from '@/components/RequestForm';
import { smsConfigured } from '@/lib/sms';

export default async function NewRequestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('form');
  const tc = await getTranslations('common');

  // Reference data comes from the constants, not the database: the page then
  // prerenders, costs no query, and stays available even if the DB blips.
  const isAr = locale === 'ar';
  const categoryRows = CATEGORIES;
  const wilayaRows = WILAYAS;

  // Fire-prone wilayas float to the top: in a wildfire emergency they are
  // where nearly every request will come from.
  const fireProne = new Set<string>(FIRE_PRONE_WILAYA_CODES);
  const sortedWilayas = [
    ...wilayaRows.filter((w) => fireProne.has(w.code)),
    ...wilayaRows.filter((w) => !fireProne.has(w.code)),
  ];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>

      {/* The emergency gate comes before the form, always. */}
      <EmergencyBanner />

      <RequestForm
        allowHomeDelivery={smsConfigured()}
        locale={locale}
        categories={categoryRows.map((c) => ({
          code: c.code,
          label: isAr ? c.nameAr : c.nameFr,
        }))}
        wilayas={sortedWilayas.map((w) => ({
          code: w.code,
          label: isAr ? w.nameAr : w.nameFr,
        }))}
      />
    </main>
  );
}
