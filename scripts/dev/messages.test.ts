import ar from '../../messages/ar.json' with { type: 'json' };
import fr from '../../messages/fr.json' with { type: 'json' };

/**
 * Locale parity gate.
 *
 * A missing key does not throw — next-intl falls back — so French would
 * silently appear inside an Arabic page. In a crisis app that reads as the
 * site being broken, so the build fails instead.
 */
type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v as Json, key)
      : [key];
  });
}

const arKeys = new Set(flatten(ar as Json));
const frKeys = new Set(flatten(fr as Json));

const missingInFr = [...arKeys].filter((k) => !frKeys.has(k));
const missingInAr = [...frKeys].filter((k) => !arKeys.has(k));

for (const k of missingInFr) console.log(`FAIL  missing in fr.json: ${k}`);
for (const k of missingInAr) console.log(`FAIL  missing in ar.json: ${k}`);

const fails = missingInFr.length + missingInAr.length;
console.log(
  fails === 0
    ? `ok    locale parity: ${arKeys.size} keys in both ar and fr\n\nALL PASS`
    : `\n${fails} FAILURE(S)`,
);
process.exit(fails === 0 ? 0 : 1);
