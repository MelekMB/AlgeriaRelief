import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getDraft } from '@/lib/draft';
import { formatNational } from '@/lib/phone';
import VerifyForm from '@/components/VerifyForm';

export const dynamic = 'force-dynamic';

export default async function VerifyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const draft = await getDraft();
  if (!draft) redirect(`/${locale}/request/new`);

  const t = await getTranslations('verify');

  // Show only the tail of the number, so a shared or shoulder-surfed screen
  // does not expose it in full.
  const national = formatNational(draft.phoneE164);
  const masked = national.replace(/\d(?=\d{2})/g, '•');

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <VerifyForm locale={locale} phoneMasked={masked} />
    </main>
  );
}
