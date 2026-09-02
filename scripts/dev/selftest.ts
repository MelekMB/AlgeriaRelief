import { parsePhone as parseAlgerianMobile, formatNational } from '../../src/lib/phone.js';
import { encrypt, decrypt, sign, unsign, hashToken, numericCode } from '../../src/lib/crypto.js';

let fails = 0;
const check = (name: string, cond: boolean, extra = '') => {
  if (!cond) { fails++; console.log(`FAIL  ${name} ${extra}`); }
  else console.log(`ok    ${name}`);
};

// --- phone parsing: the shapes people actually paste ---
const cases: Array<[string, string | null]> = [
  ['0555 12 34 56', '+213555123456'],
  ['+213 555 123 456', '+213555123456'],
  ['00213555123456', '+213555123456'],
  ['555123456', '+213555123456'],
  ['0661234567', '+213661234567'],
  ['0771234567', '+213771234567'],
  ['+213 0555 123 456', '+213555123456'],
  ['00213 0661234567', '+213661234567'],
  ['021 12 34 56', null],      // landline (Algiers) -> rejected
  ['0455123456', null],        // not a mobile prefix
  ['+33612345678', '+33612345678'],   // French mobile, now accepted
  ['+44 7700 900123', '+447700900123'],
  ['0044 7700 900123', '+447700900123'],
  ['+1 415 555 2671', '+14155552671'],
  ['+9', null],                        // far too short
  ['', null],
];
for (const [input, expected] of cases) {
  const r = parseAlgerianMobile(input);
  const got = r.ok ? r.e164 : null;
  check(`phone "${input}" -> ${expected ?? 'reject'}`, got === expected, `(got ${got})`);
}

check('formatNational', formatNational('+213555123456') === '0555 12 34 56', formatNational('+213555123456'));

// --- crypto ---
const secret = 'x'.repeat(64);
process.env.SESSION_SECRET = secret;

const addr = 'Cité 200 logements, Bât B, Akbou';
check('encrypt/decrypt round-trip', decrypt(encrypt(addr)) === addr);
check('ciphertext differs each call', encrypt(addr) !== encrypt(addr));
check('ciphertext is not plaintext', !encrypt(addr).includes('Akbou'));

const signed = sign(JSON.stringify({ personId: 7 }));
check('sign/unsign round-trip', unsign(signed) === JSON.stringify({ personId: 7 }));
check('tampered signature rejected', unsign(signed.slice(0, -3) + 'aaa') === null);

check('hashToken is stable', hashToken('abc') === hashToken('abc'));
check('hashToken differs', hashToken('abc') !== hashToken('abd'));

const code = numericCode(4);
check('numericCode length + digits only', code.length === 4 && /^[0-9]{4}$/.test(code), code);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
