import { getTranslations } from 'next-intl/server';
import { EMERGENCY_NUMBERS } from '@/config/emergency';

/**
 * A life-threatening situation must leave this app immediately — it is not a
 * rescue service.
 *
 * Two variants. The full panel is unmissable but, sat at the top of the home
 * page, it made the whole app look like an emergency directory and pushed the
 * two things people actually came for below the fold. So the home page now
 * carries the one-line version up top and the full panel at the bottom;
 * pages people reach mid-task still use the full one.
 */
export default async function EmergencyBanner({
  variant = 'full',
}: {
  variant?: 'full' | 'compact';
}) {
  const t = await getTranslations('emergency');
  const first = EMERGENCY_NUMBERS[0]!;

  if (variant === 'compact') {
    return (
      <a
        href={`tel:${first.number}`}
        className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-danger/40 bg-danger-surface px-3 py-2 text-sm"
      >
        <span className="font-semibold text-danger">{t('bannerTitle')}</span>
        <span className="flex items-center gap-1 font-bold text-danger">
          {t(first.key)}
          <bdi className="font-mono text-base">{first.number}</bdi>
        </span>
      </a>
    );
  }

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
