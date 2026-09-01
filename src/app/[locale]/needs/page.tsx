import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CATEGORIES } from '@/data/categories';
import { FIRE_PRONE_WILAYA_CODES, WILAYAS } from '@/data/wilayas';
import { Link } from '@/i18n/routing';
import { listOpenRequests } from '@/lib/requests';

export const dynamic = 'force-dynamic';

function timeAgo(date: Date, locale: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

export default async function NeedsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ wilaya?: string; category?: string }>;
}) {
  const { locale } = await params;
  const { wilaya, category } = await searchParams;
  setRequestLocale(locale);

  const t = await getTranslations('needs');
  const tc = await getTranslations('common');
  const tu = await getTranslations('urgency');
  const isAr = locale === 'ar';

  const wilayaRows = WILAYAS;
  const categoryRows = CATEGORIES;
  const rows = await listOpenRequests({ wilayaCode: wilaya, categoryCode: category });

  const fireProne = new Set<string>(FIRE_PRONE_WILAYA_CODES);
  const sortedWilayas = [
    ...wilayaRows.filter((w) => fireProne.has(w.code)),
    ...wilayaRows.filter((w) => !fireProne.has(w.code)),
  ];

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>

      {/* Plain GET form: works with no JavaScript, which matters on a
          throttled connection where the JS bundle may never arrive. */}
      <form method="get" className="flex gap-2">
        <select
          name="wilaya"
          defaultValue={wilaya ?? ''}
          aria-label={t('filterWilaya')}
          className="min-h-12 flex-1 rounded-lg border border-border bg-bg px-2 text-sm"
        >
          <option value="">{t('filterWilaya')}</option>
          {sortedWilayas.map((w) => (
            <option key={w.code} value={w.code}>
              {isAr ? w.nameAr : w.nameFr}
            </option>
          ))}
        </select>

        <select
          name="category"
          defaultValue={category ?? ''}
          aria-label={t('filterCategory')}
          className="min-h-12 flex-1 rounded-lg border border-border bg-bg px-2 text-sm"
        >
          <option value="">{t('filterCategory')}</option>
          {categoryRows.map((c) => (
            <option key={c.code} value={c.code}>
              {isAr ? c.nameAr : c.nameFr}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="min-h-12 rounded-lg border-2 border-brand px-4 text-sm font-bold text-brand"
        >
          {tc('next')}
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="font-semibold">{t('empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('emptyHint')}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/needs/${r.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-brand px-2 py-1 text-xs font-bold text-brand-contrast">
                    {isAr ? r.categoryNameAr : r.categoryNameFr}
                  </span>
                  {r.urgency !== 'normal' && (
                    <span className="rounded-md border border-danger px-2 py-1 text-xs font-bold text-danger">
                      {tu(r.urgency)}
                    </span>
                  )}
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      r.requesterVerified ? 'bg-border text-text' : 'border border-border text-muted'
                    }`}
                  >
                    {r.requesterVerified ? t('verified') : t('unverified')}
                  </span>
                </div>

                <p className="line-clamp-3 text-sm">{r.body}</p>

                <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>
                    {isAr ? r.communeNameAr : r.communeNameFr} · {isAr ? r.wilayaNameAr : r.wilayaNameFr}
                  </span>
                  <bdi>{timeAgo(r.createdAt, locale)}</bdi>
                  <span>
                    {r.deliveryPoint === 'home' ? t('deliverHome') : t('deliverLandmark')}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
