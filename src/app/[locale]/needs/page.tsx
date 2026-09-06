import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import {
  countOpenByCategory,
  countOpenByWilaya,
  listOpenRequests,
} from '@/lib/requests';

export const dynamic = 'force-dynamic';

function timeAgo(date: Date, locale: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60000));
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

/** Keeps the other filter intact when one chip is tapped. */
function hrefWith(current: { wilaya?: string; category?: string }, patch: Record<string, string | undefined>) {
  const next = { ...current, ...patch };
  const params = new URLSearchParams();
  if (next.wilaya) params.set('wilaya', next.wilaya);
  if (next.category) params.set('category', next.category);
  const qs = params.toString();
  return qs ? `/needs?${qs}` : '/needs';
}

function Chip({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3 text-sm font-semibold ${
        active
          ? 'border-brand bg-brand text-brand-contrast'
          : 'border-border bg-surface text-text'
      }`}
    >
      <span>{label}</span>
      {count !== undefined && (
        <bdi
          className={`rounded-full px-1.5 text-xs ${
            active ? 'bg-brand-contrast/20' : 'bg-border'
          }`}
        >
          {count}
        </bdi>
      )}
    </Link>
  );
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

  const [rows, byWilaya, byCategory] = await Promise.all([
    listOpenRequests({ wilayaCode: wilaya, categoryCode: category }),
    countOpenByWilaya(),
    countOpenByCategory(),
  ]);

  const total = byWilaya.reduce((sum, r) => sum + Number(r.n), 0);
  const current = { wilaya, category };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Link href="/" className="min-h-12 px-2 py-2 text-sm text-muted">
          {tc('back')}
        </Link>
      </div>

      {/* Filters as chips rather than a form. Two reviewers looked at the old
          dropdowns and concluded no filtering existed - a control nobody
          notices may as well not be there. Counts also answer the donor's
          real first question, "is anything needed near me?", without tapping. */}
      {byWilaya.length > 0 && (
        <nav aria-label={t('filterWilaya')} className="flex flex-col gap-2">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip
              href={hrefWith(current, { wilaya: undefined })}
              label={t('allWilayas')}
              count={total}
              active={!wilaya}
            />
            {byWilaya.map((w) => (
              <Chip
                key={w.code}
                href={hrefWith(current, { wilaya: w.code })}
                label={isAr ? w.nameAr : w.nameFr}
                count={Number(w.n)}
                active={wilaya === w.code}
              />
            ))}
          </div>

          {byCategory.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              <Chip
                href={hrefWith(current, { category: undefined })}
                label={t('allCategories')}
                active={!category}
              />
              {byCategory.map((c) => (
                <Chip
                  key={c.code}
                  href={hrefWith(current, { category: c.code })}
                  label={isAr ? c.nameAr : c.nameFr}
                  count={Number(c.n)}
                  active={category === c.code}
                />
              ))}
            </div>
          )}
        </nav>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6 text-center">
          <p className="font-semibold">{t('empty')}</p>
          <p className="mt-1 text-sm text-muted">{t('emptyHint')}</p>
          {(wilaya || category) && (
            <Link
              href="/needs"
              className="mt-4 inline-flex min-h-12 items-center rounded-lg border-2 border-brand px-4 font-bold text-brand"
            >
              {t('clearFilters')}
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/needs/${r.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
              >
                {/* Where it is, first and biggest. A donor's opening question
                    is "how far is this?", and it used to be answered in 12px
                    grey text under everything else. */}
                <p className="text-lg font-bold leading-tight">
                  {isAr ? r.communeNameAr : r.communeNameFr}
                  <span className="text-muted"> · </span>
                  <span className="text-base font-semibold text-muted">
                    {isAr ? r.wilayaNameAr : r.wilayaNameFr}
                  </span>
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-brand px-2 py-1 text-xs font-bold text-brand-contrast">
                    {isAr ? r.categoryNameAr : r.categoryNameFr}
                  </span>
                  {r.urgency !== 'normal' && (
                    <span className="rounded-md border border-danger px-2 py-1 text-xs font-bold text-danger">
                      {tu(r.urgency)}
                    </span>
                  )}
                  <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted">
                    {r.requesterVerified ? t('verified') : t('unverified')}
                  </span>
                </div>

                <p className="line-clamp-3 text-sm">{r.body}</p>

                <div className="flex flex-wrap gap-x-3 text-xs text-muted">
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
