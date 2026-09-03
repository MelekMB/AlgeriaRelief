import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import {
  CLAIM_WINDOW_HOURS,
  MAX_REQUESTS_PER_TRIP,
  UNVERIFIED_DAILY_CLAIM_CAP,
} from '@/lib/claims';
import { getPublicRequest } from '@/lib/requests';
import ClaimButton from '@/components/ClaimButton';
import FlagButton from '@/components/FlagButton';

export const dynamic = 'force-dynamic';

export default async function NeedDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const requestId = Number(id);
  if (!Number.isFinite(requestId)) notFound();

  const row = await getPublicRequest(requestId);
  if (!row) notFound();

  const t = await getTranslations('detail');
  const tn = await getTranslations('needs');
  const tu = await getTranslations('urgency');
  const tc = await getTranslations('common');
  const isAr = locale === 'ar';

  const claimable = row.status === 'open';

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <Link href="/needs" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-brand px-2 py-1 text-xs font-bold text-brand-contrast">
          {isAr ? row.categoryNameAr : row.categoryNameFr}
        </span>
        {row.urgency !== 'normal' && (
          <span className="rounded-md border border-danger px-2 py-1 text-xs font-bold text-danger">
            {tu(row.urgency)}
          </span>
        )}
        <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted">
          {row.requesterVerified ? tn('verified') : tn('unverified')}
        </span>
      </div>

      <p className="whitespace-pre-line text-base">{row.body}</p>

      <p className="text-sm text-muted">
        {isAr ? row.communeNameAr : row.communeNameFr} ·{' '}
        {isAr ? row.wilayaNameAr : row.wilayaNameFr} ·{' '}
        {row.deliveryPoint === 'home' ? tn('deliverHome') : tn('deliverLandmark')}
      </p>

      {/* Safety rules appear at the moment of commitment, not in a footer
          nobody reads. */}
      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-bold">{t('beforeYouGo')}</h2>
        <ul className="mt-2 space-y-2 text-sm text-muted">
          <li className="font-semibold text-text">{t('ruleNoMoney')}</li>
          <li>{t('ruleTellSomeone')}</li>
          <li>{t('ruleCode')}</li>
        </ul>
      </section>

      {claimable ? (
        <ClaimButton
          locale={locale}
          requestId={row.id}
          claimHours={CLAIM_WINDOW_HOURS}
          maxPerTrip={MAX_REQUESTS_PER_TRIP}
          dailyCap={UNVERIFIED_DAILY_CLAIM_CAP}
        />
      ) : (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm font-semibold">
          {tn('reserved')}
        </p>
      )}

      <FlagButton locale={locale} requestId={row.id} />
    </main>
  );
}
