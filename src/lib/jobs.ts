import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { people, requests } from '@/db/schema';
import { expireStaleRequests, releaseExpiredClaims } from './claims';
import { decrypt } from './crypto';
import { sendSms } from './sms';

/**
 * Background maintenance.
 *
 * ⚠️  These jobs are the reason `.replit` pins deployment to Reserved VM.
 *     On Autoscale, work that continues after a response is sent is
 *     throttled or killed: claims would never lapse, dead requests would
 *     never expire, and the board would quietly rot while looking healthy.
 */

const STILL_NEEDED_AFTER_HOURS = 24;
const HIDE_IF_UNANSWERED_AFTER_HOURS = 24;

export type MaintenanceReport = {
  claimsReleased: number;
  requestsExpired: number;
  stillNeededSent: number;
  unansweredHidden: number;
};

export async function runMaintenance(): Promise<MaintenanceReport> {
  const claimsReleased = await releaseExpiredClaims();
  const unansweredHidden = await hideUnanswered();
  const stillNeededSent = await sendStillNeededPings();
  const requestsExpired = await expireStaleRequests();

  return { claimsReleased, requestsExpired, stillNeededSent, unansweredHidden };
}

/**
 * Asks the requester whether they still need help. This is what stops donors
 * driving to a need that was met hours ago by a neighbour.
 */
async function sendStillNeededPings(): Promise<number> {
  const cutoff = new Date(Date.now() - STILL_NEEDED_AFTER_HOURS * 60 * 60 * 1000);

  const due = await db
    .select({ id: requests.id, phone: people.phoneE164 })
    .from(requests)
    .innerJoin(people, eq(people.id, requests.personId))
    .where(
      and(
        eq(requests.status, 'open'),
        isNull(requests.stillNeededAskedAt),
        lt(requests.createdAt, cutoff),
      ),
    )
    .limit(100);

  let sent = 0;
  for (const row of due) {
    try {
      await sendSms(decrypt(row.phone), String(row.id));
      await db
        .update(requests)
        .set({ stillNeededAskedAt: new Date() })
        .where(eq(requests.id, row.id));
      sent++;
    } catch (err) {
      console.error('[jobs] still-needed ping failed', row.id, err);
    }
  }
  return sent;
}

/**
 * Hides requests whose owner never answered the "still needed?" ping.
 * Failing closed here is deliberate: an unanswered request is more likely
 * met than urgent, and a stale board is what kills these platforms.
 */
async function hideUnanswered(): Promise<number> {
  const cutoff = new Date(Date.now() - HIDE_IF_UNANSWERED_AFTER_HOURS * 60 * 60 * 1000);

  const hidden = await db
    .update(requests)
    .set({ status: 'expired' })
    .where(
      and(
        eq(requests.status, 'open'),
        lt(requests.stillNeededAskedAt, cutoff),
      ),
    )
    .returning({ id: requests.id });

  return hidden.length;
}

/** Confirmed-delivery counters for the public ledger. */
export async function deliveryStats(): Promise<{ delivered: number; open: number }> {
  const [row] = await db
    .select({
      delivered: sql<number>`count(*) filter (where ${requests.status} = 'delivered')::int`,
      open: sql<number>`count(*) filter (where ${requests.status} = 'open')::int`,
    })
    .from(requests);

  return row ?? { delivered: 0, open: 0 };
}
