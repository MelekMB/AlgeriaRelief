import { getTranslations, setRequestLocale } from 'next-intl/server';
import SigninForm from '@/components/SigninForm';

export const dynamic = 'force-dynamic';

export default async function SigninPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('detail');
  const tv = await getTranslations('verify');

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">{tv('title')}</h1>
      <p className="text-sm text-muted">{t('needVerify')}</p>
      <SigninForm locale={locale} next={next ?? '/needs'} />
    </main>
  );
}
