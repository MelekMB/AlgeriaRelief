import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { people } from '@/db/schema';
import { encrypt, hashToken } from './crypto';

export type PersonRecord = typeof people.$inferSelect;

/**
 * Creates or updates the person behind a phone number.
 *
 * `verified: false` is the SMS-failure fallback tier — the person can post,
 * but their request ranks below verified ones and they may not claim a
 * request or see anyone's address.
 */
export async function upsertPerson(
  e164: string,
  { verified }: { verified: boolean },
): Promise<number> {
  const phoneHash = hashToken(e164);
  const now = new Date();

  const [existing] = await db
    .select({ id: people.id, phoneVerifiedAt: people.phoneVerifiedAt })
    .from(people)
    .where(eq(people.phoneHash, phoneHash))
    .limit(1);

  if (existing) {
    await db
      .update(people)
      .set({
        // Never downgrade someone who has already verified.
        phoneVerifiedAt: verified ? now : existing.phoneVerifiedAt,
        lastSeenAt: now,
      })
      .where(eq(people.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(people)
    .values({
      phoneE164: encrypt(e164),
      phoneHash,
      phoneVerifiedAt: verified ? now : null,
      lastSeenAt: now,
    })
    .returning({ id: people.id });

  return created!.id;
}

export async function getPerson(personId: number): Promise<PersonRecord | null> {
  const [row] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  return row ?? null;
}

export function isVerified(person: PersonRecord | null): boolean {
  return Boolean(person?.phoneVerifiedAt) && !person!.isSuspended;
}

/**
 * Trust weight for flag scoring. New accounts count for almost nothing so a
 * brigade of fresh numbers cannot suppress a legitimate request.
 */
export function flagWeight(person: PersonRecord): number {
  if (person.isSuspended) return 0;
  if (!person.phoneVerifiedAt) return 0;
  if (person.upheldFlagsCount > 0) return 1;
  return 1 + Math.min(person.deliveriesCount + person.receivedCount, 5);
}
