import { and, eq, gt, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  categories as categoriesTable,
  communes,
  contactReveals,
  people,
  requests,
  tripRequests,
  trips,
} from '@/db/schema';
import { numericCode, safeEqual } from './crypto';
import { getPerson, isVerified } from './people';
import { smsConfigured } from './sms';
import { notifyRequesterOfClaim } from './requests';

/**
 * The claim lock.
 *
 * Claiming reserves a request for a fixed window and hides it from every
 * other donor. Without this, everyone opens the app, sees the same top
 * request, and five cars arrive at one house while four other families get
 * nobody — which is worse than the WhatsApp groups this replaces.
 */

export const CLAIM_WINDOW_HOURS = Number(process.env.CLAIM_WINDOW_HOURS ?? 6);
export const MAX_REQUESTS_PER_TRIP = 5;

/**
 * How many requests one unverified person may claim per day.
 *
 * Only applies when there is no verification channel configured at all. It is
 * the stand-in for phone verification: someone collecting contact details has
 * to come back day after day instead of harvesting the board in one sitting.
 */
export const UNVERIFIED_DAILY_CLAIM_CAP = 3;

export type ClaimResult =
  | { ok: true; requestId: number; tripId: number; claimExpiresAt: Date }
  | {
      ok: false;
      reason:
        | 'not_verified'
        | 'suspended'
        | 'already_claimed'
        | 'not_found'
        | 'trip_full'
        | 'different_wilaya'
        | 'own_request'
        | 'daily_cap'
        | 'home_needs_verify';
    };

export async function claimRequest(requestId: number, personId: number): Promise<ClaimResult> {
  const person = await getPerson(personId);
  if (!person) return { ok: false, reason: 'not_found' };
  if (person.isSuspended) return { ok: false, reason: 'suspended' };

  // When an SMS provider exists, verification is required - that is what
  // protects a home address. With no provider at all, requiring it would mean
  // nobody can ever deliver anything, so the app runs in a reduced mode:
  // landmark meetings only, no home addresses, and a hard daily claim cap.
  const canVerify = smsConfigured();

  if (canVerify && !isVerified(person)) return { ok: false, reason: 'not_verified' };

  if (!canVerify && !isVerified(person)) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ used }] = await db
      .select({ used: sql<number>`count(*)::int` })
      .from(contactReveals)
      .where(and(eq(contactReveals.personId, personId), gt(contactReveals.revealedAt, since)));

    if (Number(used) >= UNVERIFIED_DAILY_CLAIM_CAP) return { ok: false, reason: 'daily_cap' };
  }

  const [target] = await db
    .select({
      id: requests.id,
      personId: requests.personId,
      communeId: requests.communeId,
      deliveryPoint: requests.deliveryPoint,
      wilayaId: communes.wilayaId,
    })
    .from(requests)
    .innerJoin(communes, eq(communes.id, requests.communeId))
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!target) return { ok: false, reason: 'not_found' };
  if (target.personId === personId) return { ok: false, reason: 'own_request' };

  // A home address is only ever handed to a verified person, whatever mode
  // the app is running in.
  if (target.deliveryPoint === 'home' && !isVerified(person)) {
    return { ok: false, reason: 'home_needs_verify' };
  }

  // One open trip per donor. An existing trip may take more requests
  // (batching), but only within the same wilaya — this is a distance filter,
  // not a routing engine.
  const trip = await getActiveTrip(personId);

  if (trip) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tripRequests)
      .where(eq(tripRequests.tripId, trip.id));

    if (count >= MAX_REQUESTS_PER_TRIP) return { ok: false, reason: 'trip_full' };
    if (trip.wilayaId !== null && trip.wilayaId !== target.wilayaId) {
      return { ok: false, reason: 'different_wilaya' };
    }
  }

  const now = new Date();
  const claimExpiresAt = trip
    ? trip.expiresAt
    : new Date(now.getTime() + CLAIM_WINDOW_HOURS * 60 * 60 * 1000);

  // Atomic: the WHERE clause is the lock. Two donors tapping at the same
  // moment cannot both succeed — the second update matches zero rows.
  const claimed = await db
    .update(requests)
    .set({
      status: 'claimed',
      claimedByPersonId: personId,
      claimedAt: now,
      claimExpiresAt,
      // The door code was set when the request was created and the family
      // already has it. Regenerating here would leave them reading out a
      // number the donor's screen no longer expects.
    })
    .where(
      and(
        eq(requests.id, requestId),
        eq(requests.status, 'open'),
        gt(requests.expiresAt, now),
        or(isNull(requests.claimExpiresAt), lt(requests.claimExpiresAt, now))!,
      ),
    )
    .returning({ id: requests.id });

  if (claimed.length === 0) return { ok: false, reason: 'already_claimed' };

  const tripId = trip
    ? trip.id
    : (
        await db
          .insert(trips)
          .values({ donorPersonId: personId, expiresAt: claimExpiresAt, status: 'claimed' })
          .returning({ id: trips.id })
      )[0]!.id;

  await db.insert(tripRequests).values({ tripId, requestId });

  // Tell the receiver someone is coming, and give them their door code.
  // A failed SMS must not fail the claim — the donor still has the details.
  try {
    await notifyRequesterOfClaim(requestId);
  } catch (err) {
    console.error('[claim] could not notify requester', err);
  }

  return { ok: true, requestId, tripId, claimExpiresAt };
}

async function getActiveTrip(personId: number) {
  const [trip] = await db
    .select({ id: trips.id, expiresAt: trips.expiresAt })
    .from(trips)
    .where(
      and(
        eq(trips.donorPersonId, personId),
        eq(trips.status, 'claimed'),
        gt(trips.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!trip) return null;

  // Wilaya of whatever is already on the trip, for the batching check.
  const [first] = await db
    .select({ wilayaId: communes.wilayaId })
    .from(tripRequests)
    .innerJoin(requests, eq(requests.id, tripRequests.requestId))
    .innerJoin(communes, eq(communes.id, requests.communeId))
    .where(eq(tripRequests.tripId, trip.id))
    .limit(1);

  return { ...trip, wilayaId: first?.wilayaId ?? null };
}

/* ------------------------------------------------------------------ */
/* Delivery confirmation                                               */
/* ------------------------------------------------------------------ */

export type ConfirmResult = { ok: true } | { ok: false; reason: 'not_claimant' | 'wrong_code' };

/**
 * The receiver reads a 4-digit code aloud; the donor types it. Neither side
 * can complete this alone, which is what makes the public delivery count
 * mean something.
 */
export async function confirmDelivery(
  requestId: number,
  personId: number,
  code: string,
): Promise<ConfirmResult> {
  const [row] = await db
    .select({
      claimedBy: requests.claimedByPersonId,
      confirmCode: requests.confirmCode,
      requesterId: requests.personId,
      status: requests.status,
    })
    .from(requests)
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!row || row.claimedBy !== personId || row.status !== 'claimed') {
    return { ok: false, reason: 'not_claimant' };
  }
  if (!row.confirmCode || !safeEqual(code.trim(), row.confirmCode)) {
    return { ok: false, reason: 'wrong_code' };
  }

  const now = new Date();

  await db
    .update(requests)
    .set({ status: 'delivered', closedAt: now })
    .where(eq(requests.id, requestId));

  await db
    .update(tripRequests)
    .set({ deliveredAt: now, confirmedByCode: true })
    .where(eq(tripRequests.requestId, requestId));

  await db
    .update(people)
    .set({ deliveriesCount: sql`${people.deliveriesCount} + 1` })
    .where(eq(people.id, personId));

  await db
    .update(people)
    .set({ receivedCount: sql`${people.receivedCount} + 1` })
    .where(eq(people.id, row.requesterId));

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Background sweepers — these are why deployment must be Reserved VM. */
/* On Autoscale they are throttled or killed and the board rots.       */
/* ------------------------------------------------------------------ */

/**
 * Returns lapsed claims to the pool and records a no-show against the donor.
 * Repeated no-shows are how someone would farm addresses without ever
 * delivering, so the counter feeds throttling and suspension.
 */
export async function releaseExpiredClaims(): Promise<number> {
  const now = new Date();

  // Read the donors BEFORE clearing the claim. RETURNING gives the new row
  // values, so reading claimed_by_person_id after nulling it would always
  // come back null and no-shows would never be recorded.
  const lapsed = await db
    .select({ id: requests.id, donorId: requests.claimedByPersonId })
    .from(requests)
    .where(and(eq(requests.status, 'claimed'), lt(requests.claimExpiresAt, now)));

  if (lapsed.length === 0) {
    await db
      .update(trips)
      .set({ status: 'expired' })
      .where(and(eq(trips.status, 'claimed'), lt(trips.expiresAt, now)));
    return 0;
  }

  const ids = lapsed.map((r) => r.id);

  await db
    .update(requests)
    .set({
      status: 'open',
      claimedByPersonId: null,
      claimedAt: null,
      claimExpiresAt: null,
    })
    .where(inArray(requests.id, ids));

  for (const row of lapsed) {
    if (row.donorId === null) continue;
    await db
      .update(people)
      .set({ noShowCount: sql`${people.noShowCount} + 1` })
      .where(eq(people.id, row.donorId));
  }

  await db
    .update(trips)
    .set({ status: 'expired' })
    .where(and(eq(trips.status, 'claimed'), lt(trips.expiresAt, now)));

  return lapsed.length;
}

/** Expires requests past their TTL so nobody drives to a dead need. */
export async function expireStaleRequests(): Promise<number> {
  const expired = await db
    .update(requests)
    .set({ status: 'expired' })
    .where(
      and(
        or(eq(requests.status, 'open'), eq(requests.status, 'claimed'))!,
        lt(requests.expiresAt, new Date()),
      ),
    )
    .returning({ id: requests.id });

  return expired.length;
}

/* ------------------------------------------------------------------ */
/* Donor's current trip                                                */
/* ------------------------------------------------------------------ */

export type TripItem = {
  requestId: number;
  body: string;
  categoryNameAr: string;
  categoryNameFr: string;
  communeNameAr: string;
  communeNameFr: string;
  status: string;
  deliveredAt: Date | null;
};

export async function getActiveTripItems(
  personId: number,
): Promise<{ tripId: number; expiresAt: Date; items: TripItem[] } | null> {
  const [trip] = await db
    .select({ id: trips.id, expiresAt: trips.expiresAt })
    .from(trips)
    .where(
      and(
        eq(trips.donorPersonId, personId),
        eq(trips.status, 'claimed'),
        gt(trips.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!trip) return null;

  const items = await db
    .select({
      requestId: requests.id,
      body: requests.body,
      categoryNameAr: categoriesTable.nameAr,
      categoryNameFr: categoriesTable.nameFr,
      communeNameAr: communes.nameAr,
      communeNameFr: communes.nameFr,
      status: requests.status,
      deliveredAt: tripRequests.deliveredAt,
    })
    .from(tripRequests)
    .innerJoin(requests, eq(requests.id, tripRequests.requestId))
    .innerJoin(categoriesTable, eq(categoriesTable.id, requests.categoryId))
    .innerJoin(communes, eq(communes.id, requests.communeId))
    .where(eq(tripRequests.tripId, trip.id));

  return { tripId: trip.id, expiresAt: trip.expiresAt, items };
}
