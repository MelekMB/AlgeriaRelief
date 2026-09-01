import { screenText, dedupeFingerprint, normaliseForDedupe } from '../../src/lib/screening.js';

let fails = 0;
const check = (name: string, cond: boolean, extra = '') => {
  if (!cond) {
    fails++;
    console.log(`FAIL  ${name} ${extra}`);
  } else console.log(`ok    ${name}`);
};

const expectAction = (label: string, text: string, want: 'allow' | 'shadow' | 'block') => {
  const v = screenText(text);
  check(`${want.padEnd(6)} ${label}`, v.action === want, `(got ${v.action} [${v.reasons.join(',')}])`);
};

/* --- Must be BLOCKED: anything that creates a payment rail --- */
expectAction('Algerian IBAN', 'حسابي DZ58 0002 1000 0012 3456 7890', 'block');
expectAction('RIB label', 'RIB: 00300123456789012345', 'block');
expectAction('long account run', 'العدد 0021 0000 1234 5678 9012', 'block');
expectAction('CCP (latin)', 'envoyez au CCP 1234567 clé 25', 'block');
expectAction('CCP (arabic)', 'الحساب البريدي الجاري 1234567', 'block');
expectAction('BaridiMob', 'ابعثلي على بريدي موب', 'block');
expectAction('Western Union', 'Send via Western Union please', 'block');
expectAction('BTC address', 'btc 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', 'block');
expectAction('ETH address', 'eth 0x52908400098527886E0F7030069857D2E4169EE7', 'block');
expectAction('GoFundMe', 'aidez-nous sur gofundme', 'block');
expectAction('money request AR', 'من فضلكم أرسلوا لي المال', 'block');
expectAction('money request FR', "merci d'envoyer de l'argent", 'block');
expectAction('Arabic-Indic digits IBAN', 'DZ٥٨ ٠٠٠٢ ١٠٠٠ ٠٠١٢ ٣٤٥٦ ٧٨٩٠', 'block');

/* --- Must be SHADOWED: contact details belong in the gated reveal --- */
expectAction('phone in body', 'اتصل بي 0555 12 34 56', 'shadow');
expectAction('phone plain', 'call 0661234567', 'shadow');
expectAction('external link', 'voir https://example.com/aide', 'shadow');
expectAction('email', 'contact: someone@example.com', 'shadow');

/* --- Must be ALLOWED: ordinary relief requests --- */
expectAction(
  'genuine AR request',
  'عائلة من 6 أفراد فقدت منزلها في الحريق، نحتاج ماء وأغطية.',
  'allow',
);
expectAction(
  'genuine FR request',
  "Famille de 6 personnes, maison brûlée. Nous avons besoin d'eau et de couvertures.",
  'allow',
);
expectAction('quantities are fine', 'نحتاج 20 لتر ماء و 10 أغطية لـ 12 عائلة', 'allow');
expectAction('darija/arabizi', '3ndna 3ailat kbira, n7tajou lma w khobz', 'allow');
expectAction('price mention is fine', 'كل شيء احترق، حتى 5000 دج ديال الأدوية', 'allow');

/* --- Dedupe --- */
const a = dedupeFingerprint({ body: 'نحتاج ماءً وأغطية!', communeId: 3, categoryId: 1 });
const b = dedupeFingerprint({ body: 'نحتاج ماء و أغطية', communeId: 3, categoryId: 1 });
check('dedupe: punctuation/diacritics ignored', a === b, `${a.slice(0, 8)} vs ${b.slice(0, 8)}`);

const c = dedupeFingerprint({ body: 'نحتاج ماء وأغطية', communeId: 4, categoryId: 1 });
check('dedupe: different commune differs', a !== c);

check(
  'dedupe: accents normalised',
  normaliseForDedupe("Besoin d'eau à Béjaïa") === normaliseForDedupe('besoin d eau a bejaia'),
  normaliseForDedupe("Besoin d'eau à Béjaïa"),
);

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
