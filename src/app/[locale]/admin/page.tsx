import { getTranslations, setRequestLocale } from 'next-intl/server';
import { listQuarantined } from '@/lib/flags';
import { deliveryStats } from '@/lib/jobs';
import { isReadOnly, throttledWilayas } from '@/lib/settings';
import AdminLogin from '@/components/AdminLogin';
import { isAdmin, settingsAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('admin');

  if (!(await isAdmin())) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-col gap-5 px-4 py-10">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <AdminLogin />
      </main>
    );
  }

  const [stats, quarantined, readOnly, throttled] = await Promise.all([
    deliveryStats(),
    listQuarantined(),
    isReadOnly(),
    throttledWilayas(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <section>
        <h2 className="text-base font-bold">{t('counters')}</h2>
        <div className="mt-2 flex gap-3">
          <div className="flex-1 rounded-xl border border-border bg-surface p-4 text-center">
            <p className="font-mono text-3xl font-bold">
              <bdi>{stats.delivered}</bdi>
            </p>
            <p className="text-xs text-muted">delivered</p>
          </div>
          <div className="flex-1 rounded-xl border border-border bg-surface p-4 text-center">
            <p className="font-mono text-3xl font-bold">
              <bdi>{stats.open}</bdi>
            </p>
            <p className="text-xs text-muted">open</p>
          </div>
        </div>
      </section>

      {/* Kill switch. If abuse spikes at 3am and nobody is watching, this is
          the one control that stops everything. */}
      <section className="rounded-xl border border-danger/40 p-4">
        <h2 className="text-base font-bold">{t('readOnly')}</h2>
        <form action={settingsAction} className="mt-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="intent" value="readonly" />
          <input type="hidden" name="value" value={readOnly ? '0' : '1'} />
          <button
            type="submit"
            className={`min-h-12 w-full rounded-lg font-bold ${
              readOnly
                ? 'bg-brand text-brand-contrast'
                : 'border-2 border-danger text-danger'
            }`}
          >
            {readOnly ? t('readOnlyOff') : t('readOnlyOn')}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-border p-4">
        <h2 className="text-base font-bold">{t('throttle')}</h2>
        <form action={settingsAction} className="mt-2 flex gap-2">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="intent" value="throttle" />
          <label className="sr-only" htmlFor="wilayas">
            {t('throttle')}
          </label>
          <input
            id="wilayas"
            name="wilayas"
            defaultValue={throttled.join(',')}
            placeholder="06,15"
            className="min-h-12 flex-1 rounded-lg border border-border bg-bg px-3 font-mono"
          />
          <button
            type="submit"
            className="min-h-12 rounded-lg border-2 border-brand px-4 font-bold text-brand"
          >
            {t('save')}
          </button>
        </form>
        <p className="mt-1 text-xs text-muted">{t('throttleHint')}</p>
      </section>

      <section>
        <h2 className="text-base font-bold">
          {t('quarantine')} (<bdi>{quarantined.length}</bdi>)
        </h2>
        {quarantined.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t('none')}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {quarantined.map((q) => (
              <li key={q.id} className="rounded-xl border border-border bg-surface p-4">
                <p className="text-sm">{q.body}</p>
                {q.screeningReason && (
                  <p className="mt-1 font-mono text-xs text-muted">{q.screeningReason}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <form action={settingsAction} className="flex-1">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="intent" value="keep" />
                    <input type="hidden" name="requestId" value={q.id} />
                    <button
                      type="submit"
                      className="min-h-12 w-full rounded-lg border-2 border-brand font-bold text-brand"
                    >
                      {t('keep')}
                    </button>
                  </form>
                  <form action={settingsAction} className="flex-1">
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="intent" value="remove" />
                    <input type="hidden" name="requestId" value={q.id} />
                    <button
                      type="submit"
                      className="min-h-12 w-full rounded-lg border-2 border-danger font-bold text-danger"
                    >
                      {t('remove')}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
