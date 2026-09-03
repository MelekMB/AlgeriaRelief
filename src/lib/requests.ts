import { and, asc, desc, eq, gt, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { categories, communes, contactReveals, people, requests, wilayas } from '@/db/schema';
import { decrypt, encrypt as encryptValue, numericCode } from './crypto';
import { formatNational } from './phone';

/**
 * ⚠️  SECURITY BOUNDARY — READ THIS BEFORE ADDING A QUERY.
 *
 * There is no Row Level Security in this stack, so the claim check is
 * enforced here in application code and nowhere else. Every read path for
 * a request MUST go through a function in this file.
 *
 * `addressEncrypted` and `people.phoneE164` are decrypted in exactly one
 * place: `getRequestForClaimant`. Do not select those columns anywhere
 * else, and never add them to a list projection — a single `select()`
 * without an explicit column list would leak a vulnerable person's home
 * address into a public page.
 */

/* ------------------------------------------------------------------ */
/* Public projection — safe for anyone, logged out included.           */
/* ------------------------------------------------------------------ */

const publicColumns = {
  id: requests.id,
  body: requests.body,
  urgency: requests.urgency,
  status: requests.status,
  deliveryPoint: requests.deliveryPoint,
  beneficiary: requests.beneficiary,
  createdAt: requests.createdAt,
  expiresAt: requests.expiresAt,
  claimExpiresAt: requests.claimExpiresAt,
  categoryCode: categories.code,
  categoryIcon: categories.icon,
  categoryNameAr: categories.nameAr,
  categoryNameFr: categories.nameFr,
  communeId: communes.id,
  communeNameAr: communes.nameAr,
  communeNameFr: communes.nameFr,
  wilayaCode: wilayas.code,
  wilayaNameAr: wilayas.nameAr,
  wilayaNameFr: wilayas.nameFr,
  requesterVerified: sql<boolean>`${people.phoneVerifiedAt} is not null`,
  requesterDeliveries: people.receivedCount,
} as const;

export type PublicRequest = {
  [K in keyof typeof publicColumns]: unknown;
} & {
  id: number;
  body: string;
  urgency: 'normal' | 'high' | 'critical';
  status: string;
  deliveryPoint: 'home' | 'landmark';
  createdAt: Date;
  expiresAt: Date;
  claimExpiresAt: Date | null;
  categoryCode: string;
  categoryIcon: string;
  categoryNameAr: string;
  categoryNameFr: string;
  communeId: number;
  communeNameAr: string;
  communeNameFr: string;
  wilayaCode: string;
  wilayaNameAr: string;
  wilayaNameFr: string;
  requesterVerified: boolean;
};

const baseJoins = () =>
  db
    .select(publicColumns)
    .from(requests)
    .innerJoin(categories, eq(categories.id, requests.categoryId))
    .innerJoin(communes, eq(communes.id, requests.communeId))
    .innerJoin(wilayas, eq(wilayas.id, communes.wilayaId))
    .innerJoin(people, eq(people.id, requests.personId));

export type ListFilters = {
  wilayaCode?: string;
  communeId?: number;
  categoryCode?: string;
  limit?: number;
};

/**
 * Open requests, ranked.
 *
 * A request that is currently claimed by someone else is excluded entirely —
 * that is the whole point of the claim lock. Nobody should see, let alone
 * drive to, a need another donor has already reserved.
 */
export async function listOpenRequests(filters: ListFilters = {}) {
  const now = new Date();

  const conditions = [
    eq(requests.status, 'open'),
    gt(requests.expiresAt, now),
    // Not under an active claim.
    or(isNull(requests.claimExpiresAt), sql`${requests.claimExpiresAt} < now()`)!,
  ];

  if (filters.wilayaCode) conditions.push(eq(wilayas.code, filters.wilayaCode));
  if (filters.communeId) conditions.push(eq(requests.communeId, filters.communeId));
  if (filters.categoryCode) conditions.push(eq(categories.code, filters.categoryCode));

  // Proximity first when a commune is in play, then urgency, then verified
  // above unverified, then oldest unmet first so quiet requesters do not
  // starve behind a stream of new posts.
  //
  // The proximity term is omitted entirely when there is no commune filter.
  // A bare `sql`0`` here is NOT a no-op: Postgres reads a plain integer in
  // ORDER BY as an ordinal column position, so it fails with
  // "ORDER BY position 0 is not in select list".
  const order = [];
  if (filters.communeId) {
    order.push(sql`case when ${requests.communeId} = ${filters.communeId} then 0 else 1 end`);
  }
  order.push(sql`case ${requests.urgency} when 'critical' then 0 when 'high' then 1 else 2 end`);
  order.push(desc(sql`${people.phoneVerifiedAt} is not null`));
  order.push(asc(requests.createdAt));

  return baseJoins()
    .where(and(...conditions))
    .orderBy(...order)
    .limit(Math.min(filters.limit ?? 50, 100));
}

/** Public detail view. Carries no address and no phone number. */
export async function getPublicRequest(id: number) {
  const [row] = await baseJoins().where(eq(requests.id, id)).limit(1);
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Gated accessor — the ONLY place contact details are decrypted.      */
/* ------------------------------------------------------------------ */

export type RevealedContact = {
  phoneNational: string;
  phoneE164: string;
  address: string | null;
  landmarkHint: string | null;
  deliveryPoint: 'home' | 'landmark';
  confirmCode: string;
};

/**
 * Returns the receiver's contact details to the donor holding the active
 * claim — and to nobody else.
 *
 * Returns null rather than throwing so a caller can never accidentally
 * treat a rejection as a partial success.
 */
export async function getRequestForClaimant(
  requestId: number,
  personId: number,
): Promise<RevealedContact | null> {
  const [row] = await db
    .select({
      claimedBy: requests.claimedByPersonId,
      claimExpiresAt: requests.claimExpiresAt,
      status: requests.status,
      addressEncrypted: requests.addressEncrypted,
      landmarkHint: requests.landmarkHint,
      deliveryPoint: requests.deliveryPoint,
      confirmCode: requests.confirmCode,
      requesterPhone: people.phoneE164,
    })
    .from(requests)
    .innerJoin(people, eq(people.id, requests.personId))
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!row) return null;
  if (row.claimedBy !== personId) return null;
  if (row.status !== 'claimed' && row.status !== 'delivered') return null;
  // An expired claim revokes access immediately, even before the sweeper runs.
  if (row.status === 'claimed' && (!row.claimExpiresAt || row.claimExpiresAt < new Date())) {
    return null;
  }

  const phoneE164 = decrypt(row.requesterPhone);

  return {
    phoneE164,
    phoneNational: formatNational(phoneE164),
    address: row.addressEncrypted ? decrypt(row.addressEncrypted) : null,
    landmarkHint: row.landmarkHint,
    deliveryPoint: row.deliveryPoint,
    confirmCode: row.confirmCode ?? '',
  };
}

/** Every reveal is logged. Quota enforcement and scraper detection read this. */
export async function logReveal(
  requestId: number,
  personId: number,
  meta: { ip?: string; userAgent?: string },
) {
  await db.insert(contactReveals).values({
    requestId,
    personId,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  });
}

/* ------------------------------------------------------------------ */
/* Duplicate detection                                                 */
/* ------------------------------------------------------------------ */

export async function findDuplicate(fingerprint: string) {
  const [row] = await db
    .select({ id: requests.id, body: requests.body, createdAt: requests.createdAt })
    .from(requests)
    .where(
      and(
        eq(requests.dedupeFingerprint, fingerprint),
        isNotNull(requests.id),
        gt(requests.expiresAt, new Date()),
        or(eq(requests.status, 'open'), eq(requests.status, 'claimed'))!,
      ),
    )
    .limit(1);
  return row ?? null;
}

/** One open request per phone number. A second requires closing the first. */
export async function hasOpenRequest(personId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: requests.id })
    .from(requests)
    .where(
      and(
        eq(requests.personId, personId),
        or(eq(requests.status, 'open'), eq(requests.status, 'claimed'))!,
        gt(requests.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

export const REQUEST_TTL_HOURS = Number(process.env.REQUEST_TTL_HOURS ?? 72);

export type CreateRequestInput = {
  personId: number;
  categoryCode: string;
  communeId: number;
  body: string;
  urgency: 'normal' | 'high' | 'critical';
  beneficiary: 'self' | 'family' | 'neighbour';
  deliveryPoint: 'home' | 'landmark';
  address?: string;
  landmarkHint?: string;
  screeningScore: number;
  screeningReason: string;
  dedupeFingerprint: string;
  shadowed: boolean;
};

export async function createRequest(
  input: CreateRequestInput,
): Promise<{ id: number; manageCode: string; confirmCode: string } | null> {
  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.code, input.categoryCode))
    .limit(1);

  if (!category) return null;

  const manageCode = numericCode(6);
  // The door code is generated now, not when a donor claims, so the person
  // asking for help has it in their hand from the start. With no SMS there is
  // no way to tell them later, and a donor arriving to a family who does not
  // know the number cannot complete the delivery.
  const confirmCode = numericCode(4);

  const [row] = await db
    .insert(requests)
    .values({
      manageCode,
      confirmCode,
      personId: input.personId,
      categoryId: category.id,
      communeId: input.communeId,
      body: input.body,
      urgency: input.urgency,
      beneficiary: input.beneficiary,
      deliveryPoint: input.deliveryPoint,
      // Address is encrypted before it ever reaches the database.
      addressEncrypted: input.address ? encryptValue(input.address) : null,
      landmarkHint: input.landmarkHint ?? null,
      screeningScore: input.screeningScore,
      screeningReason: input.screeningReason,
      dedupeFingerprint: input.dedupeFingerprint,
      // A shadowed post is published but ranked last and queued for review.
      status: input.shadowed ? 'quarantined' : 'open',
      expiresAt: new Date(Date.now() + REQUEST_TTL_HOURS * 60 * 60 * 1000),
    })
    .returning({ id: requests.id });

  return row ? { id: row.id, manageCode, confirmCode } : null;
}

/**
 * Sign in to your own request with the reference code shown when you posted.
 *
 * This is the account recovery path when there is no verification channel:
 * knowing someone's phone number is not enough, you must also have the code
 * only the poster was shown.
 */
export async function findByReference(
  phoneHash: string,
  manageCode: string,
): Promise<number | null> {
  const [row] = await db
    .select({ personId: requests.personId })
    .from(requests)
    .innerJoin(people, eq(people.id, requests.personId))
    .where(and(eq(people.phoneHash, phoneHash), eq(requests.manageCode, manageCode.trim())))
    .orderBy(desc(requests.createdAt))
    .limit(1);

  return row?.personId ?? null;
}

/** The reference code, shown only to the person who posted. */
export async function getOwnManageCode(
  requestId: number,
  personId: number,
): Promise<string | null> {
  const [row] = await db
    .select({ code: requests.manageCode })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.personId, personId)))
    .limit(1);
  return row?.code ?? null;
}

/**
 * Tells the receiver that a donor is on the way, and gives them the 4-digit
 * code they will read aloud at the door.
 *
 * The decrypt lives here rather than in claims.ts so that every decryption
 * of a phone number stays inside this file's security boundary.
 */
export async function notifyRequesterOfClaim(requestId: number): Promise<void> {
  const [row] = await db
    .select({ phone: people.phoneE164, code: requests.confirmCode })
    .from(requests)
    .innerJoin(people, eq(people.id, requests.personId))
    .where(eq(requests.id, requestId))
    .limit(1);

  if (!row?.code) return;

  const { sendSms } = await import('./sms');
  await sendSms(decrypt(row.phone), row.code);
}

/* ------------------------------------------------------------------ */
/* The requester's own request — close and renew                       */
/* ------------------------------------------------------------------ */

export async function getOwnRequest(personId: number) {
  const [row] = await baseJoins()
    .where(
      and(
        eq(requests.personId, personId),
        or(
          eq(requests.status, 'open'),
          eq(requests.status, 'claimed'),
          eq(requests.status, 'quarantined'),
        )!,
      ),
    )
    .orderBy(desc(requests.createdAt))
    .limit(1);
  return row ?? null;
}

/** Closing is one tap and is what keeps the board honest. */
export async function closeOwnRequest(requestId: number, personId: number): Promise<boolean> {
  const closed = await db
    .update(requests)
    .set({ status: 'delivered', closedAt: new Date() })
    .where(and(eq(requests.id, requestId), eq(requests.personId, personId)))
    .returning({ id: requests.id });
  return closed.length > 0;
}

/**
 * Renewing answers the "still needed?" ping and pushes the expiry out.
 * Clearing `stillNeededAskedAt` is what stops the sweeper hiding it.
 */
export async function renewOwnRequest(requestId: number, personId: number): Promise<boolean> {
  const renewed = await db
    .update(requests)
    .set({
      expiresAt: new Date(Date.now() + REQUEST_TTL_HOURS * 60 * 60 * 1000),
      stillNeededAskedAt: null,
      renewedCount: sql`${requests.renewedCount} + 1`,
    })
    .where(and(eq(requests.id, requestId), eq(requests.personId, personId)))
    .returning({ id: requests.id });
  return renewed.length > 0;
}

/** The receiver's door code, shown only to the person who posted the request. */
export async function getOwnConfirmCode(
  requestId: number,
  personId: number,
): Promise<string | null> {
  const [row] = await db
    .select({ code: requests.confirmCode })
    .from(requests)
    .where(and(eq(requests.id, requestId), eq(requests.personId, personId)))
    .limit(1);
  return row?.code ?? null;
}
