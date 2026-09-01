import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import EmergencyBanner from '@/components/EmergencyBanner';

export default async function AbusePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('abuse');
  const tc = await getTranslations('common');
  const email = process.env.ABUSE_EMAIL ?? '';

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>

      <EmergencyBanner />

      <p>{t('intro')}</p>

      <ul className="space-y-2 text-sm">
        <li className="font-semibold">{t('w1')}</li>
        <li>{t('w2')}</li>
        <li>{t('w3')}</li>
      </ul>

      {email && (
        <p className="rounded-xl border border-border bg-surface p-4">
          <span className="font-semibold">{t('email')}: </span>
          <a href={`mailto:${email}`} className="text-brand underline">
            <bdi>{email}</bdi>
          </a>
        </p>
      )}
    </main>
  );
}
