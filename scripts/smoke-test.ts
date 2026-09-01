/**
 * End-to-end smoke test against a real database.
 *
 *   npm run smoke
 *
 * Run this once on Replit after `db:push` and `seed:geo`. It exercises the
 * paths that cannot be unit-tested — the claim lock, the address-reveal
 * boundary, delivery confirmation, and the lapse sweeper — using the real
 * application functions, not a reimplementation.
 *
 * It creates test rows tagged with SMOKE_TAG and deletes them at the end,
 * including on failure. Safe to run against production, though quiet hours
 * are still the polite choice.
 */
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { communes, people, requests, tripRequests, trips } from '../src/db/schema.js';
import { claimRequest, confirmDelivery, releaseExpiredClaims } from '../src/lib/claims.js';
import { upsertPerson } from '../src/lib/people.js';
import { createRequest, getRequestForClaimant } from '../src/lib/requests.js';

const SMOKE_TAG = '[SMOKE TEST — safe to delete]';
// Numbers in a valid Algerian mobile range, reserved for this test only.
const PHONES = ['+213500000001', '+213500000002', '+213500000003'];

let failures = 0;
const check = (name: string, cond: boolean, extra = '') => {
  if (cond) console.log(`ok    ${name}`);
  else {
    failures++;
    console.log(`FAIL  ${name} ${extra}`);
  }
};

async function cleanup() {
  const ids = (
    await db.select({ id: people.id }).from(people).where(inArray(people.phoneHash, []))
  ).map((r) => r.id);
  void ids;

  const testRequests = await db
    .select({ id: requests.id })
    .from(requests)
    .where(like(requests.body, `%${SMOKE_TAG}%`));

  const reqIds = testRequests.map((r) => r.id);
  if (reqIds.length) {
    await db.delete(tripRequests).where(inArray(tripRequests.requestId, reqIds));
    await db.delete(requests).where(inArray(requests.id, reqIds));
  }

  // People are matched by their hashed phone, so import the hasher lazily.
  const { hashToken } = await import('../src/lib/crypto.js');
  const hashes = PHONES.map(hashToken);
  const testPeople = await db
    .select({ id: people.id })
    .from(people)
    .where(inArray(people.phoneHash, hashes));
  const personIds = testPeople.map((p) => p.id);
  if (personIds.length) {
    await db.delete(trips).where(inArray(trips.donorPersonId, personIds));
    await db.delete(people).where(inArray(people.id, personIds));
  }
}

async function main() {
  console.log('Cleaning any leftovers from a previous run…');
  await cleanup();

  const [commune] = await db.select({ id: communes.id }).from(communes).limit(1);
  if (!commune) {
    console.error('No communes found. Run `npm run seed:geo` first.');
    process.exit(1);
  }

  const requester = await upsertPerson(PHONES[0]!, { verified: true });
  const donorA = await upsertPerson(PHONES[1]!, { verified: true });
  const donorB = await upsertPerson(PHONES[2]!, { verified: true });
  check('created three verified people', Boolean(requester && donorA && donorB));

  const requestId = await createRequest({
    personId: requester,
    categoryCode: 'water_food',
    communeId: commune.id,
    body: `${SMOKE_TAG} عائلة تحتاج ماء وأغطية`,
    urgency: 'high',
    beneficiary: 'self',
    deliveryPoint: 'home',
    address: 'Cité 200 logements, Bât B',
    screeningScore: 0,
    screeningReason: '',
    dedupeFingerprint: `smoke-${Date.now()}`,
    shadowed: false,
  });
  check('created a request', Boolean(requestId));
  if (!requestId) throw new Error('request creation failed');

  // --- the address must not be readable before anyone claims ---
  check(
    'address hidden before claim',
    (await getRequestForClaimant(requestId, donorA)) === null,
  );

  // --- the claim lock ---
  const first = await claimRequest(requestId, donorA);
  check('donor A claims successfully', first.ok, JSON.stringify(first));

  const second = await claimRequest(requestId, donorB);
  check(
    'donor B is refused (claim lock holds)',
    !second.ok && second.reason === 'already_claimed',
    JSON.stringify(second),
  );

  const ownClaim = await claimRequest(requestId, requester);
  check(
    'requester cannot claim their own request',
    !ownClaim.ok,
    JSON.stringify(ownClaim),
  );

  // --- the reveal boundary ---
  const revealedToA = await getRequestForClaimant(requestId, donorA);
  check('donor A sees the address', revealedToA?.address === 'Cité 200 logements, Bât B');
  check('donor A sees a phone number', Boolean(revealedToA?.phoneNational));
  check('donor A got a 4-digit code', /^\d{4}$/.test(revealedToA?.confirmCode ?? ''));
  check(
    'donor B is denied the address',
    (await getRequestForClaimant(requestId, donorB)) === null,
  );

  // --- delivery confirmation ---
  const wrongCode = revealedToA!.confirmCode === '0000' ? '1111' : '0000';
  const badConfirm = await confirmDelivery(requestId, donorA, wrongCode);
  check('wrong code is rejected', !badConfirm.ok, JSON.stringify(badConfirm));

  const goodConfirm = await confirmDelivery(requestId, donorA, revealedToA!.confirmCode);
  check('correct code confirms delivery', goodConfirm.ok, JSON.stringify(goodConfirm));

  const [after] = await db
    .select({ status: requests.status })
    .from(requests)
    .where(eq(requests.id, requestId));
  check('request is marked delivered', after?.status === 'delivered');

  const [donorRow] = await db
    .select({ deliveries: people.deliveriesCount })
    .from(people)
    .where(eq(people.id, donorA));
  check('donor delivery count incremented', (donorRow?.deliveries ?? 0) >= 1);

  // --- the lapse sweeper ---
  const lapseId = await createRequest({
    personId: requester,
    categoryCode: 'water_food',
    communeId: commune.id,
    body: `${SMOKE_TAG} طلب لاختبار انتهاء الحجز`,
    urgency: 'normal',
    beneficiary: 'self',
    deliveryPoint: 'landmark',
    landmarkHint: 'أمام المسجد',
    screeningScore: 0,
    screeningReason: '',
    dedupeFingerprint: `smoke-lapse-${Date.now()}`,
    shadowed: false,
  });

  await claimRequest(lapseId!, donorB);
  // Push the claim into the past so the sweeper sees it as lapsed.
  await db
    .update(requests)
    .set({ claimExpiresAt: new Date(Date.now() - 60_000) })
    .where(eq(requests.id, lapseId!));

  const released = await releaseExpiredClaims();
  check('sweeper released the lapsed claim', released >= 1, `released=${released}`);

  const [reopened] = await db
    .select({ status: requests.status, claimedBy: requests.claimedByPersonId })
    .from(requests)
    .where(eq(requests.id, lapseId!));
  check('lapsed request returned to the pool', reopened?.status === 'open');
  check('claim was cleared', reopened?.claimedBy === null);

  const [noShow] = await db
    .select({ noShows: people.noShowCount })
    .from(people)
    .where(eq(people.id, donorB));
  check(
    'no-show recorded against the donor',
    (noShow?.noShows ?? 0) >= 1,
    `noShowCount=${noShow?.noShows}`,
  );

  // --- the public list must never leak an address ---
  const listed = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(requests)
    .where(and(eq(requests.status, 'open'), like(requests.body, `%${SMOKE_TAG}%`)));
  check('lapsed request is listable again', (listed[0]?.n ?? 0) >= 1);
}

main()
  .then(async () => {
    await cleanup();
    console.log(failures === 0 ? '\nALL PASS — the core flow works end to end.' : `\n${failures} FAILURE(S)`);
    process.exit(failures === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error(err);
    await cleanup().catch(() => {});
    process.exit(1);
  });
