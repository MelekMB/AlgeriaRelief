'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { COUNTRY_CODES, DEFAULT_DIAL, countryLabel } from '@/data/countryCodes';

/**
 * Country code plus local number.
 *
 * Algeria is preselected because it is the overwhelming majority case. Anyone
 * abroad picks their country once rather than remembering to type a plus and
 * a dialling code — which is the kind of small friction that loses people who
 * are already having a bad day.
 *
 * The two parts are submitted separately and joined on the server, so nothing
 * depends on JavaScript having reformatted the value correctly.
 */
export default function PhoneField({
  locale,
  id = 'phone',
  autoFocus = false,
}: {
  locale: string;
  id?: string;
  autoFocus?: boolean;
}) {
  const t = useTranslations('form');
  const [dial, setDial] = useState(DEFAULT_DIAL);

  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor={`${id}-country`}>
        {t('country')}
      </label>
      <select
        id={`${id}-country`}
        name="countryCode"
        value={dial}
        onChange={(event) => setDial(event.target.value)}
        className="min-h-14 max-w-[45%] rounded-lg border border-border bg-bg px-2 text-sm"
      >
        {COUNTRY_CODES.map((country) => (
          <option key={country.dial} value={country.dial}>
            {countryLabel(country, locale)}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={id}>
        {t('phone')}
      </label>
      <input
        id={id}
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        required
        placeholder={t('phoneLocalPlaceholder')}
        className="min-h-14 flex-1 rounded-lg border border-border bg-bg px-3 font-mono text-lg"
      />
    </div>
  );
}
