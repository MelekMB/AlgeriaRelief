import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditLog, flags, people, requests, reviews } from '@/db/schema';
import { flagWeight, getPerson } from './people';

/**
 * Community moderation.
 *
 * There is no moderation staff, so flags must act on their own. They are
 * weighted by the reporter's trust: a brigade of fresh numbers cannot
 * suppress a real request, while one established user can hide something
 * dangerous within seconds.
 *
 * Quarantine hides content immediately and is reversible. The bias is
 * deliberate — hide fast, restore on review. If nobody ever reviews, the
 * item simply stays hidden and expires. Silence never publishes.
 */

export const QUARANTINE_THRESHOLD = 3;
export const REVIEWS_TO_RESOLVE = 3;

export type FlagResult =
  | { ok: true; quarantined: boolean }
  | { ok: false; reason: 'not_verified' | 'already_flagged' | 'not_found' };

export async function flagRequest(
  requestId: number,
  personId: number,
  reason: string,
): Promise<FlagResult> {
  const person = await getPerson(personId);
  if (!person || !person.phoneVerifiedAt || person.isSuspended) {
    return { ok: false, reason: 'not_verified' };
  }

  const [existing] = await db
    .select({ id: flags.id })
    .from(flags)
    .where(
      and(
        eq(flags.targetType, 'request'),
        eq(flags.targetId, requestId),
        eq(flags.reporterPersonId, personId),
      ),
    )
    .limit(1);

  if (existing) return { ok: false, reason: 'already_flagged' };

  const weight = flagWeight(person);

  await db.insert(flags).values({
    targetType: 'request',
    targetId: requestId,
    reporterPersonId: personId,
    reason: reason.slice(0, 500),
    reporterTrustWeight: weight,
  });

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${flags.reporterTrustWeight}), 0)::int` })
    .from(flags)
    .where(and(eq(flags.targetType, 'request'), eq(flags.targetId, requestId)));

  if (total >= QUARANTINE_THRESHOLD) {
    const hidden = await db
      .update(requests)
      .set({ status: 'quarantined' })
      .where(and(eq(requests.id, requestId), eq(requests.status, 'open')))
      .returning({ id: requests.id });

    if (hidden.length > 0) {
      await db.insert(auditLog).values({
        actor: 'system',
        action: 'auto_quarantine',
        targetType: 'request',
        targetId: requestId,
        metadata: JSON.stringify({ weightedFlags: total }),
      });
      return { ok: true, quarantined: true };
    }
  }

  return { ok: true, quarantined: false };
}

/* ------------------------------------------------------------------ */
/* Community review queue                                              */
/* ------------------------------------------------------------------ */

/** Earned, not granted: verified + at least two confirmed exchanges + clean record. */
export async function canReview(personId: number): Promise<boolean> {
  const person = await getPerson(personId);
  if (!person || !person.phoneVerifiedAt || person.isSuspended) return false;
  if (person.upheldFlagsCount > 0) return false;
  return person.deliveriesCount + person.receivedCount >= 2;
}

export async function listQuarantined(limit = 25) {
  return db
    .select({
      id: requests.id,
      body: requests.body,
      createdAt: requests.createdAt,
      screeningReason: requests.screeningReason,
    })
    .from(requests)
    .where(eq(requests.status, 'quarantined'))
    .limit(limit);
}

export type ReviewResult =
  | { ok: true; resolved: 'kept' | 'removed' | null }
  | { ok: false; reason: 'not_allowed' | 'already_reviewed' };

export async function reviewRequest(
  requestId: number,
  personId: number,
  decision: 'keep' | 'remove',
): Promise<ReviewResult> {
  if (!(await canReview(personId))) return { ok: false, reason: 'not_allowed' };

  const [existing] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.targetType, 'request'),
        eq(reviews.targetId, requestId),
        eq(reviews.reviewerPersonId, personId),
      ),
    )
    .limit(1);

  if (existing) return { ok: false, reason: 'already_reviewed' };

  await db.insert(reviews).values({
    targetType: 'request',
    targetId: requestId,
    reviewerPersonId: personId,
    decision,
  });

  const rows = await db
    .select({ decision: reviews.decision })
    .from(reviews)
    .where(and(eq(reviews.targetType, 'request'), eq(reviews.targetId, requestId)));

  const keeps = rows.filter((r) => r.decision === 'keep').length;
  const removes = rows.filter((r) => r.decision === 'remove').length;

  if (removes >= REVIEWS_TO_RESOLVE) {
    await db.update(requests).set({ status: 'removed' }).where(eq(requests.id, requestId));
    // The poster carries an upheld flag, which zeroes their flag weight.
    await db
      .update(people)
      .set({ upheldFlagsCount: sql`${people.upheldFlagsCount} + 1` })
      .where(eq(people.id, sql`(select person_id from requests where id = ${requestId})`));
    return { ok: true, resolved: 'removed' };
  }

  if (keeps >= REVIEWS_TO_RESOLVE) {
    await db.update(requests).set({ status: 'open' }).where(eq(requests.id, requestId));
    return { ok: true, resolved: 'kept' };
  }

  return { ok: true, resolved: null };
}
