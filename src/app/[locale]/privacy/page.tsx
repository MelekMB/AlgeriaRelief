import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('privacy');
  const tc = await getTranslations('common');

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>

      <p>{t('intro')}</p>

      <section>
        <h2 className="text-base font-bold">{t('collect')}</h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
          <li>{t('c1')}</li>
          <li>{t('c2')}</li>
          <li>{t('c3')}</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-bold">{t('notCollect')}</h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
          <li>{t('n1')}</li>
          <li>{t('n2')}</li>
          <li>{t('n3')}</li>
        </ul>
      </section>

      <p className="text-sm text-muted">{t('retention')}</p>
      <p className="text-sm text-muted">{t('rights')}</p>
    </main>
  );
}
