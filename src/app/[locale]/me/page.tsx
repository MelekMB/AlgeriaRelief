import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { getActiveTripItems } from '@/lib/claims';
import { getPerson, ownMaskedPhone } from '@/lib/people';
import { getOwnRequest } from '@/lib/requests';
import { getSession } from '@/lib/session';
import { signOutAction } from '../my-request/actions';

export const dynamic = 'force-dynamic';

/**
 * One place that answers "who am I, and what do I have open?".
 *
 * The pieces existed but were scattered: a request lived at /my-request, a
 * delivery at /trip, and nothing anywhere said whether you were signed in or
 * as which number. People with two roles - posting for their family and
 * delivering for a neighbour - had no way to see both.
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('profile');
  const tc = await getTranslations('common');

  const session = await getSession();

  // Signed out: say so plainly and offer the two ways forward, rather than
  // bouncing to a sign-in form with no explanation.
  if (!session) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
            {tc('back')}
          </Link>
        </div>

        <Link
          href="/signin?next=/me"
          className="flex min-h-14 items-center justify-center rounded-xl bg-brand font-bold text-brand-contrast"
        >
          {t('signIn')}
        </Link>
        <Link
          href="/request/new"
          className="flex min-h-14 items-center justify-center rounded-xl border-2 border-brand font-bold text-brand"
        >
          {t('postRequest')}
        </Link>
      </main>
    );
  }

  const [person, phone, own, trip] = await Promise.all([
    getPerson(session.personId),
    ownMaskedPhone(session.personId),
    session.scope === 'full' ? getOwnRequest(session.personId) : Promise.resolve(null),
    getActiveTripItems(session.personId),
  ]);

  const tripCount = trip?.items.length ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>

      {phone && (
        <p className="rounded-xl border border-border bg-surface p-4">
          <span className="text-sm text-muted">{t('yourNumber')}</span>
          <span className="mt-1 block font-mono text-lg font-bold">
            <bdi>{phone}</bdi>
          </span>
        </p>
      )}

      {/* Your own request */}
      <section className="rounded-xl border border-border p-4">
        <h2 className="text-base font-bold">{t('request')}</h2>

        {session.scope !== 'full' ? (
          <>
            <p className="mt-2 text-sm text-muted">{t('limited')}</p>
            <Link
              href="/signin?next=/my-request"
              className="mt-3 flex min-h-12 items-center justify-center rounded-lg border-2 border-brand font-bold text-brand"
            >
              {t('openRequest')}
            </Link>
          </>
        ) : own ? (
          <>
            <p className="mt-2 text-sm font-semibold">{t('requestOpen')}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{own.body}</p>
            <Link
              href="/my-request"
              className="mt-3 flex min-h-12 items-center justify-center rounded-lg bg-brand font-bold text-brand-contrast"
            >
              {t('openRequest')}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">{t('noRequest')}</p>
            <Link
              href="/request/new"
              className="mt-3 flex min-h-12 items-center justify-center rounded-lg border-2 border-brand font-bold text-brand"
            >
              {t('postRequest')}
            </Link>
          </>
        )}
      </section>

      {/* Deliveries you have taken on */}
      <section className="rounded-xl border border-border p-4">
        <h2 className="text-base font-bold">{t('trip')}</h2>

        {tripCount > 0 ? (
          <>
            <p className="mt-2 text-sm font-semibold">{t('tripOpen', { count: tripCount })}</p>
            <Link
              href="/trip"
              className="mt-3 flex min-h-12 items-center justify-center rounded-lg bg-brand font-bold text-brand-contrast"
            >
              {t('openTrip')}
            </Link>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">{t('noTrip')}</p>
            <Link
              href="/needs"
              className="mt-3 flex min-h-12 items-center justify-center rounded-lg border-2 border-brand font-bold text-brand"
            >
              {t('browse')}
            </Link>
          </>
        )}
      </section>

      {person && (person.deliveriesCount > 0 || person.receivedCount > 0) && (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-bold">{t('stats')}</h2>
          <div className="mt-2 flex gap-4 text-sm">
            <span>
              {t('delivered')}: <bdi className="font-mono font-bold">{person.deliveriesCount}</bdi>
            </span>
            <span>
              {t('received')}: <bdi className="font-mono font-bold">{person.receivedCount}</bdi>
            </span>
          </div>
        </section>
      )}

      <form action={signOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="min-h-12 text-sm text-muted underline">
          {tc('signOut')}
        </button>
      </form>
    </main>
  );
}
