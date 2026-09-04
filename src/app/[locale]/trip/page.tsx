import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getActiveTripItems } from '@/lib/claims';
import { getRequestForClaimant } from '@/lib/requests';
import { getSession } from '@/lib/session';
import ConfirmDeliveryForm from '@/components/ConfirmDeliveryForm';
import { releaseAction } from './actions';

export const dynamic = 'force-dynamic';

function remaining(expiresAt: Date, locale: string): string {
  const minutes = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return minutes < 90
    ? rtf.format(minutes, 'minute').replace(/^.*?(\d)/, '$1')
    : rtf.format(Math.round(minutes / 60), 'hour').replace(/^.*?(\d)/, '$1');
}

export default async function TripPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await getSession();
  if (!session) redirect(`/${locale}/signin?next=/trip`);

  const t = await getTranslations('trip');
  const tc = await getTranslations('common');
  const isAr = locale === 'ar';

  const trip = await getActiveTripItems(session.personId);

  if (!trip || trip.items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted">{t('empty')}</p>
        <Link
          href="/needs"
          className="flex min-h-14 items-center justify-center rounded-xl border-2 border-brand font-bold text-brand"
        >
          {t('browse')}
        </Link>
      </main>
    );
  }

  // Contact details are fetched one request at a time through the gated
  // accessor — never selected in the list query above.
  const withContacts = await Promise.all(
    trip.items.map(async (item) => ({
      item,
      contact: await getRequestForClaimant(item.requestId, session.personId),
    })),
  );

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/needs" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>

      <p className="rounded-lg border border-border bg-surface p-3 text-sm font-semibold">
        {t('expiresIn', { time: remaining(trip.expiresAt, locale) })}
      </p>

      <ul className="flex flex-col gap-4">
        {withContacts.map(({ item, contact }) => (
          <li key={item.requestId} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-brand px-2 py-1 text-xs font-bold text-brand-contrast">
                {isAr ? item.categoryNameAr : item.categoryNameFr}
              </span>
              <span className="text-xs text-muted">
                {isAr ? item.communeNameAr : item.communeNameFr}
              </span>
            </div>

            <p className="mt-2 text-sm">{item.body}</p>

            {contact && (
              <>
                <p className="mt-3 text-sm">
                  <span className="font-semibold">
                    {contact.deliveryPoint === 'home' ? t('addressLabel') : t('landmarkLabel')}:
                  </span>{' '}
                  {contact.deliveryPoint === 'home' ? contact.address : contact.landmarkHint}
                </p>

                <div className="mt-3 flex gap-2">
                  <a
                    href={`tel:${contact.phoneE164}`}
                    className="flex min-h-12 flex-1 items-center justify-center rounded-lg bg-brand font-bold text-brand-contrast"
                  >
                    {t('call')} <bdi className="ms-2 font-mono">{contact.phoneNational}</bdi>
                  </a>
                  <a
                    href={`https://wa.me/${contact.phoneE164.replace('+', '')}`}
                    className="flex min-h-12 items-center justify-center rounded-lg border-2 border-brand px-4 font-bold text-brand"
                  >
                    {t('whatsapp')}
                  </a>
                </div>
              </>
            )}

            {item.status === 'delivered' ? (
              <p className="mt-3 text-sm font-bold text-brand">{t('confirmed')}</p>
            ) : (
              <>
                <ConfirmDeliveryForm locale={locale} requestId={item.requestId} />

                {/* Changing your mind must be possible: otherwise the family
                    waits out the whole window for a delivery that is not
                    coming, and the donor cannot help anywhere else. */}
                <form action={releaseAction} className="mt-3 border-t border-border pt-3">
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="requestId" value={item.requestId} />
                  <button type="submit" className="min-h-12 text-sm text-danger underline">
                    {t('release')}
                  </button>
                  <p className="mt-1 text-xs text-muted">{t('releaseHint')}</p>
                </form>
              </>
            )}
          </li>
        ))}
      </ul>

      <Link
        href="/needs"
        className="flex min-h-12 items-center justify-center text-sm font-semibold text-brand underline"
      >
        {t('addMore')}
      </Link>
    </main>
  );
}
