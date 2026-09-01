/**
 * Official emergency numbers.
 *
 * ⚠️  VERIFY EVERY NUMBER AGAINST AN AUTHORITATIVE ALGERIAN SOURCE BEFORE
 *     LAUNCH. These are working defaults, not confirmed values. A wrong
 *     number in an emergency app is the worst bug this codebase can ship.
 *     Once verified, delete this warning and set `verified: true`.
 */
export const EMERGENCY_VERIFIED = false;

export type EmergencyNumber = {
  key: 'civilProtection' | 'police' | 'gendarmerie' | 'ambulance';
  number: string;
};

export const EMERGENCY_NUMBERS: EmergencyNumber[] = [
  { key: 'civilProtection', number: '14' },
  { key: 'police', number: '17' },
  { key: 'gendarmerie', number: '1055' },
  { key: 'ambulance', number: '115' },
];
