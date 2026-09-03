import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import SigninForm from '@/components/SigninForm';
import { smsConfigured } from '@/lib/sms';
import { whatsappConfigured } from '@/lib/whatsapp';

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
  const tc = await getTranslations('common');

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8">
      {/* There was no way out of this page: someone who opened it by mistake
          was stuck unless they knew to use the browser's back button. */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tv('title')}</h1>
        <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>
      <p className="text-sm text-muted">{t('needVerify')}</p>
      <SigninForm
        locale={locale}
        next={next ?? '/needs'}
        useReference={!smsConfigured() && !whatsappConfigured()}
      />
    </main>
  );
}
