/**
 * Send one test SMS and report exactly what the provider said.
 *
 *   npm run sms:test -- +213555123456
 *   npm run sms:test -- +33612345678
 *
 * Use this before touching the app. It answers the two questions that matter:
 * are the credentials right, and does the message actually arrive at an
 * Algerian number. Carrier delivery to +213 is the single risk in this project
 * that cannot be verified from code.
 */
import { sendSms, smsConfigured } from '../src/lib/sms.js';
import { parsePhone } from '../src/lib/phone.js';

const target = process.argv[2];

if (!target) {
  console.error('Usage: npm run sms:test -- +213555123456');
  process.exit(1);
}

const parsed = parsePhone(target);
if (!parsed.ok) {
  console.error(`"${target}" is not a valid number (${parsed.reason}).`);
  console.error('Write it in full with the country code, e.g. +213555123456');
  process.exit(1);
}

console.log(`\nProvider : ${process.env.SMS_PROVIDER ?? 'none'}`);
console.log(`Sending  : ${parsed.e164}${parsed.isAlgerian ? ' (Algerian)' : ' (international)'}`);

if (!smsConfigured()) {
  console.error('\nSMS_PROVIDER is not set, so nothing will be sent.');
  console.error('Set SMS_PROVIDER=twilio plus TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,');
  console.error('TWILIO_FROM, then run this again.');
  process.exit(1);
}

const code = String(Math.floor(100000 + Math.random() * 900000));

const result = await sendSms(parsed.e164, code);

if (result.ok) {
  console.log(`\nAccepted by ${result.provider}. Code sent: ${code}`);
  console.log('\nAccepted is not the same as delivered. Check the handset.');
  console.log('If it does not arrive within a minute or two, look at the');
  console.log('Twilio console logs - Algerian carriers sometimes reject');
  console.log('alphanumeric sender IDs, in which case you need a real number.');
  process.exit(0);
}

console.error(`\nFAILED (${result.provider}): ${result.error}`);
console.error('\nCommon causes:');
console.error('  - Trial account: Twilio only sends to numbers you have verified');
console.error('    in the console under "Verified Caller IDs".');
console.error('  - TWILIO_FROM must be a number you own, in +E.164 form.');
console.error('  - Wrong Account SID or Auth Token.');
process.exit(1);
