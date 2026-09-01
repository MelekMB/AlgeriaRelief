/**
 * Algerian mobile numbers only.
 *
 * The national significant number is 9 digits and begins with 5, 6 or 7
 * (the three mobile operators). Landlines and short codes are rejected —
 * this app sends SMS and expects a person to answer a call at the door.
 *
 * Accepted input shapes (people paste all of these):
 *   0555 12 34 56   |   +213 555 123 456   |   00213555123456   |   555123456
 */

const MOBILE_FIRST_DIGITS = new Set(['5', '6', '7']);

export type PhoneParseResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: 'empty' | 'not_algerian' | 'not_mobile' | 'bad_length' };

export function parseAlgerianMobile(input: string): PhoneParseResult {
  const raw = (input ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };

  // Keep digits only; a leading + is implied by the 213 prefix handling below.
  let digits = raw.replace(/\D/g, '');

  if (digits.startsWith('00213')) digits = digits.slice(5);
  else if (digits.startsWith('213')) digits = digits.slice(3);

  // People frequently type the country code AND the trunk zero
  // ("+213 0555 …"), so strip a leading zero after the country code too.
  // No Algerian mobile number starts with 0, so this is unambiguous.
  if (digits.startsWith('0')) digits = digits.slice(1);

  // Anything still carrying another country code is not ours to handle.
  if (digits.length > 9) return { ok: false, reason: 'not_algerian' };
  if (digits.length !== 9) return { ok: false, reason: 'bad_length' };
  if (!MOBILE_FIRST_DIGITS.has(digits[0]!)) return { ok: false, reason: 'not_mobile' };

  return { ok: true, e164: `+213${digits}`, national: `0${digits}` };
}

/**
 * Display form for a number the viewer is allowed to see.
 * Always render inside <bdi> — an unisolated number reorders inside Arabic text.
 */
export function formatNational(e164: string): string {
  const d = e164.replace(/\D/g, '').replace(/^213/, '');
  if (d.length !== 9) return e164;
  return `0${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}
