import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { settings } from '@/db/schema';

/**
 * Operator controls.
 *
 * Kept in the database rather than in environment variables so the one
 * person running this can flip them from the dashboard at 3am without a
 * redeploy. Reads are cached briefly because they sit on every request path.
 */

export const KEYS = {
  readOnly: 'read_only',
  throttledWilayas: 'throttled_wilayas',
} as const;

let cache: { at: number; values: Map<string, string> } | null = null;
const CACHE_MS = 15_000;

async function load(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.values;

  try {
    const rows = await db.select().from(settings);
    const values = new Map(rows.map((r) => [r.key, r.value]));
    cache = { at: Date.now(), values };
    return values;
  } catch {
    // If settings cannot be read, fail OPEN for reading but treat writes as
    // blocked elsewhere — never let a settings outage take the board down.
    return cache?.values ?? new Map();
  }
}

export async function isReadOnly(): Promise<boolean> {
  return (await load()).get(KEYS.readOnly) === '1';
}

export async function throttledWilayas(): Promise<string[]> {
  const raw = (await load()).get(KEYS.throttledWilayas) ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function isWilayaThrottled(code: string | undefined): Promise<boolean> {
  if (!code) return false;
  return (await throttledWilayas()).includes(code);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
  cache = null;
}

/**
 * Single gate for anything that writes user content. Returns a reason string
 * when blocked so the caller can show the right message.
 */
export async function writesBlocked(wilayaCode?: string): Promise<'read_only' | 'throttled' | null> {
  if (await isReadOnly()) return 'read_only';
  if (await isWilayaThrottled(wilayaCode)) return 'throttled';
  return null;
}
