import { createHash } from 'node:crypto';

/**
 * Deterministic submission screening.
 *
 * This runs BEFORE any LLM pass and is the load-bearing half of the fraud
 * model: charity fraud runs on payment rails, so if a payment detail can
 * never appear on the platform, the expected return on a scam drops below
 * the cost of registering a phone number.
 *
 * Blocking here is deliberately strict. A false block costs one confused
 * user who can rephrase; a false allow costs a real family their money.
 */

export type ScreeningVerdict = {
  action: 'allow' | 'shadow' | 'block';
  reasons: string[];
  score: number; // 0 clean … 100 certainly abusive
};

type Rule = { id: string; weight: number; test: RegExp };

/* ------------------------------------------------------------------ */
/* Payment rails — always a hard block.                                */
/* ------------------------------------------------------------------ */

const PAYMENT_RULES: Rule[] = [
  // IBAN (Algerian IBANs are DZ + 22 digits, but block any country's).
  { id: 'iban', weight: 100, test: /\b[A-Z]{2}\s?\d{2}(?:[\s-]?[A-Z0-9]{4}){3,7}\b/i },
  // RIB / RIP / long account digit runs.
  { id: 'long_account_number', weight: 100, test: /\b\d[\d\s-]{15,}\d\b/ },
  { id: 'rib_rip', weight: 100, test: /\b(rib|rip)\b\s*[:#]?\s*\d/i },
  { id: 'ccp', weight: 100, test: /\b(ccp|c\.c\.p)\b|ح\s*ج\s*ب|الحساب\s*البريدي/i },
  { id: 'baridimob', weight: 100, test: /baridi\s?mob|بريدي\s?موب|بريد\s*الجزائر/i },
  { id: 'wire_transfer', weight: 100, test: /western\s?union|moneygram|ويسترن\s?يونيون/i },
  { id: 'crypto_btc', weight: 100, test: /\b(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}\b/ },
  { id: 'crypto_eth', weight: 100, test: /\b0x[a-fA-F0-9]{40}\b/ },
  {
    id: 'payment_domain',
    weight: 100,
    test: /\b(paypal|gofundme|ko-?fi|patreon|leetchi|cotizup|revolut|wise\.com|cash\s?app|binance)\b/i,
  },
  {
    id: 'money_solicitation',
    weight: 100,
    // Arabic verbs take suffixes (أرسلوا, ابعثولي…), so match the verb stem
    // and then look for a money noun within a short window rather than
    // requiring the two to be adjacent.
    test:
      /(?:أرسل|ارسل|ابعث|إبعث|بعث|حوّل|حول|صيفط)[^\n]{0,24}?(?:المال|مال|فلوس|دراهم|نقود|سوردي)|تبرع[^\n]{0,16}?(?:المال|مال|فلوس)|حساب\s*(?:بنكي|جاري)|\b(?:envoyez|envoyer|virez|virer)\b[^\n]{0,16}?\bargent\b|\bvirement\b|\bmandat\s+postal\b|\bsend\s+money\b/i,
  },
];

/* ------------------------------------------------------------------ */
/* Contact leakage — must go through the gated reveal, not the body.   */
/* ------------------------------------------------------------------ */

const CONTACT_RULES: Rule[] = [
  // Algerian mobile written into the free text.
  { id: 'phone_in_body', weight: 60, test: /\b(?:\+?213|0)?\s?[5-7](?:[\s.-]?\d){8}\b/ },
  { id: 'external_link', weight: 60, test: /\b(?:https?:\/\/|www\.)\S+/i },
  { id: 'email_in_body', weight: 60, test: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/ },
  {
    id: 'messaging_handle',
    weight: 40,
    test: /\b(?:whatsapp|whats\s?app|telegram|viber|imo)\b\s*[:#]?\s*(?:\+?\d|@)/i,
  },
];

/* ------------------------------------------------------------------ */
/* Abuse                                                               */
/* ------------------------------------------------------------------ */

const ABUSE_RULES: Rule[] = [
  { id: 'excessive_caps', weight: 15, test: /\b[A-Z]{12,}\b/ },
  { id: 'repeated_chars', weight: 15, test: /(.)\1{9,}/ },
];

const ALL_RULES = [...PAYMENT_RULES, ...CONTACT_RULES, ...ABUSE_RULES];

/**
 * Arabic-Indic digits are normalised to Western ones first, so an account
 * number typed as ٠١٢٣ cannot slip past the numeric rules.
 */
export function normaliseDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

export function screenText(input: string): ScreeningVerdict {
  const text = normaliseDigits(input ?? '');
  const reasons: string[] = [];
  let score = 0;

  for (const rule of ALL_RULES) {
    if (rule.test.test(text)) {
      reasons.push(rule.id);
      score = Math.max(score, rule.weight);
    }
  }

  const action: ScreeningVerdict['action'] =
    score >= 100 ? 'block' : score >= 40 ? 'shadow' : 'allow';

  return { action, reasons, score };
}

/* ------------------------------------------------------------------ */
/* Duplicate detection                                                 */
/* ------------------------------------------------------------------ */

/**
 * Normalises away the things that differ between two people posting the
 * same need: punctuation, Arabic diacritics, letter variants, digits and
 * whitespace. Combined with commune + category this catches most
 * re-posts and well-meaning duplicates by relatives.
 */
export function normaliseForDedupe(text: string): string {
  return normaliseDigits(text)
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '') // Arabic diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Latin accents
    // Whitespace is removed entirely, not collapsed: Arabic conjunctions
    // attach or detach freely ("وأغطية" vs "و أغطية") and two people
    // reporting the same need should still fingerprint identically.
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function dedupeFingerprint(parts: {
  body: string;
  communeId: number;
  categoryId: number;
}): string {
  const basis = `${parts.communeId}:${parts.categoryId}:${normaliseForDedupe(parts.body)}`;
  return createHash('sha256').update(basis).digest('hex').slice(0, 32);
}
