import { getTranslations } from 'next-intl/server';
import { EMERGENCY_NUMBERS } from '@/config/emergency';

/**
 * Shown above the fold on every entry point. A life-threatening situation
 * must leave this app immediately — it is not a rescue service.
 */
export default async function EmergencyBanner() {
  const t = await getTranslations('emergency');

  return (
    <section
      aria-labelledby="emergency-title"
      className="rounded-xl border border-danger/30 bg-danger-surface p-4"
    >
      <h2 id="emergency-title" className="text-base font-bold text-danger">
        {t('bannerTitle')}
      </h2>

      <ul className="mt-3 flex flex-wrap gap-2">
        {EMERGENCY_NUMBERS.map(({ key, number }) => (
          <li key={key}>
            <a
              href={`tel:${number}`}
              className="flex min-h-12 items-center gap-2 rounded-lg border border-danger/40 bg-bg px-4 py-2 text-sm font-semibold text-danger"
            >
              <span>{t(key)}</span>
              {/* Isolate the number so it does not reorder inside Arabic text. */}
              <bdi className="font-mono text-base">{number}</bdi>
            </a>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm text-muted">{t('note')}</p>
    </section>
  );
}
