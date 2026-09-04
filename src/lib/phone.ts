/**
 * Phone parsing.
 *
 * Algerian numbers are the expected case and get the friendliest handling: a
 * bare local number with no country code is assumed to be Algerian.
 *
 * International numbers are accepted too, written in full with a country
 * code. Two reasons: Algerians abroad post on behalf of family back home, and
 * without it the operator cannot receive a verification code to test with.
 *
 * Trade-off worth knowing: allowing any country code makes it cheaper for
 * someone to obtain a throwaway VoIP number. The per-number caps, the
 * claim limit and no-show tracking are what actually contain that; the
 * `isAlgerian` flag is carried through so a future ranking or review rule can
 * treat foreign numbers with more suspicion if abuse shows up.
 */

const ALGERIA_CC = '213';
const ALGERIAN_MOBILE_FIRST_DIGITS = new Set(['5', '6', '7']);

// E.164 allows at most 15 digits including the country code; 8 is a safe
// lower bound for a real subscriber number.
const MIN_INTERNATIONAL_DIGITS = 8;
const MAX_INTERNATIONAL_DIGITS = 15;

export type PhoneParseResult =
  | { ok: true; e164: string; national: string; isAlgerian: boolean }
  | { ok: false; reason: 'empty' | 'not_mobile' | 'bad_length' };

export function parsePhone(input: string): PhoneParseResult {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };

  const hasInternationalPrefix = raw.startsWith('+') || raw.replace(/\D/g, '').startsWith('00');
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!digits) return { ok: false, reason: 'empty' };

  // Algerian, however it was written.
  if (digits.startsWith(ALGERIA_CC)) {
    return parseAlgerianNational(digits.slice(ALGERIA_CC.length));
  }

  // No country code at all: treat as an Algerian local number.
  if (!hasInternationalPrefix) {
    return parseAlgerianNational(digits);
  }

  // Anything else is a foreign number, kept as given.
  if (digits.length < MIN_INTERNATIONAL_DIGITS) return { ok: false, reason: 'bad_length' };
  if (digits.length > MAX_INTERNATIONAL_DIGITS) return { ok: false, reason: 'bad_length' };

  return { ok: true, e164: `+${digits}`, national: `+${digits}`, isAlgerian: false };
}

function parseAlgerianNational(input: string): PhoneParseResult {
  // People frequently type the country code AND the trunk zero ("+213 0555 …").
  const digits = input.startsWith('0') ? input.slice(1) : input;

  if (digits.length !== 9) return { ok: false, reason: 'bad_length' };
  if (!ALGERIAN_MOBILE_FIRST_DIGITS.has(digits[0]!)) return { ok: false, reason: 'not_mobile' };

  return {
    ok: true,
    e164: `+${ALGERIA_CC}${digits}`,
    national: `0${digits}`,
    isAlgerian: true,
  };
}

/** Kept for call sites that only ever deal with Algerian numbers. */
export const parseAlgerianMobile = parsePhone;

/**
 * Display form for a number the viewer is allowed to see.
 * Always render inside <bdi> — an unisolated number reorders inside Arabic text.
 */
export function formatNational(e164: string): string {
  const digits = e164.replace(/\D/g, '');

  if (digits.startsWith(ALGERIA_CC)) {
    const d = digits.slice(ALGERIA_CC.length);
    if (d.length === 9) {
      return `0${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
    }
  }

  // Foreign numbers stay in international form, lightly grouped.
  return `+${digits.replace(/(\d{1,4})(?=(\d{3})+$)/g, '$1 ')}`.trim();
}

/**
 * Joins a dialling code chosen from the picker with the local number typed
 * beside it.
 *
 * A leading zero in the local part is a trunk prefix in most of the countries
 * offered (Algeria, France, UK, Germany, Morocco...) and is never part of the
 * international form, so it is dropped. Countries whose numbers do not start
 * with zero are unaffected.
 */
export function joinCountryCode(dial: string, local: string): string {
  const cc = (dial ?? '').replace(/\D/g, '');
  let rest = (local ?? '').replace(/\D/g, '');

  // Someone who typed the country code into the number box too.
  if (cc && rest.startsWith(cc) && rest.length > cc.length) rest = rest.slice(cc.length);
  if (rest.startsWith('0')) rest = rest.slice(1);

  return cc ? `+${cc}${rest}` : rest;
}
