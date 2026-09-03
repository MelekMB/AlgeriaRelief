import {
  pgTable,
  serial,
  integer,
  text,
  varchar,
  boolean,
  timestamp,
  doublePrecision,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const urgencyEnum = pgEnum('urgency', ['normal', 'high', 'critical']);
export const beneficiaryEnum = pgEnum('beneficiary', ['self', 'family', 'neighbour']);
export const deliveryPointEnum = pgEnum('delivery_point', ['home', 'landmark']);
export const requestStatusEnum = pgEnum('request_status', [
  'open',
  'claimed',
  'delivered',
  'expired',
  'removed',
  'quarantined',
]);
export const tripStatusEnum = pgEnum('trip_status', [
  'claimed',
  'delivered',
  'expired',
  'cancelled',
]);

/* ------------------------------------------------------------------ */
/* Geography — wilaya + commune are the geographic primitive.          */
/* Free-text place names fragment the dataset, so they are never used. */
/* ------------------------------------------------------------------ */

export const wilayas = pgTable('wilayas', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 4 }).notNull().unique(), // "06", "15", ...
  nameAr: text('name_ar').notNull(),
  nameFr: text('name_fr').notNull(),
});

export const communes = pgTable(
  'communes',
  {
    id: serial('id').primaryKey(),
    wilayaId: integer('wilaya_id')
      .notNull()
      .references(() => wilayas.id, { onDelete: 'cascade' }),
    code: varchar('code', { length: 8 }).notNull(),
    nameAr: text('name_ar').notNull(),
    nameFr: text('name_fr').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
  },
  (t) => ({
    codeIdx: uniqueIndex('communes_code_idx').on(t.code),
    wilayaIdx: index('communes_wilaya_idx').on(t.wilayaId),
  }),
);

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 32 }).notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameFr: text('name_fr').notNull(),
  icon: varchar('icon', { length: 32 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

/* ------------------------------------------------------------------ */
/* People — the phone number IS the identity. No accounts, no          */
/* passwords, no email.                                                */
/* ------------------------------------------------------------------ */

export const people = pgTable(
  'people',
  {
    id: serial('id').primaryKey(),
    // Encrypted at rest at the application layer; never rendered publicly.
    phoneE164: text('phone_e164').notNull(),
    phoneHash: varchar('phone_hash', { length: 64 }).notNull(), // lookup key
    displayName: text('display_name'), // optional, shown to the matched party only
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),

    trustScore: integer('trust_score').notNull().default(0),
    deliveriesCount: integer('deliveries_count').notNull().default(0),
    receivedCount: integer('received_count').notNull().default(0),
    upheldFlagsCount: integer('upheld_flags_count').notNull().default(0),
    // Serial claiming without confirming is the main address-harvesting attack.
    noShowCount: integer('no_show_count').notNull().default(0),

    isSuspended: boolean('is_suspended').notNull().default(false),
    deviceFingerprint: text('device_fingerprint'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (t) => ({
    phoneHashIdx: uniqueIndex('people_phone_hash_idx').on(t.phoneHash),
  }),
);

export const otpCodes = pgTable(
  'otp_codes',
  {
    id: serial('id').primaryKey(),
    phoneHash: varchar('phone_hash', { length: 64 }).notNull(),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    phoneIdx: index('otp_phone_idx').on(t.phoneHash),
  }),
);

/* ------------------------------------------------------------------ */
/* Requests — the core object. Direct donor-to-receiver delivery.      */
/* ------------------------------------------------------------------ */

export const requests = pgTable(
  'requests',
  {
    id: serial('id').primaryKey(),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    communeId: integer('commune_id')
      .notNull()
      .references(() => communes.id),

    body: text('body').notNull(),
    bodyLang: varchar('body_lang', { length: 8 }), // detected; may be darija/arabizi
    urgency: urgencyEnum('urgency').notNull().default('normal'),
    beneficiary: beneficiaryEnum('beneficiary').notNull().default('self'),
    vulnerabilityFlags: text('vulnerability_flags').array(),
    photoUrl: text('photo_url'),

    // Delivery is direct, so an address (or a landmark) is required.
    // Encrypted at rest, never public, revealed only to the claiming donor.
    deliveryPoint: deliveryPointEnum('delivery_point').notNull().default('landmark'),
    addressEncrypted: text('address_encrypted'),
    landmarkHint: text('landmark_hint'),

    // The claim lock: the single mechanism that prevents duplicate trips.
    claimedByPersonId: integer('claimed_by_person_id').references(() => people.id),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    claimExpiresAt: timestamp('claim_expires_at', { withTimezone: true }),
    confirmCode: varchar('confirm_code', { length: 8 }), // 4 digits, read aloud at the door
    // Shown once to the poster. Lets them return to their own request from
    // another device without a verification SMS, and stops anyone who merely
    // knows their phone number from taking it over.
    manageCode: varchar('manage_code', { length: 8 }),

    status: requestStatusEnum('status').notNull().default('open'),

    screeningScore: integer('screening_score'),
    screeningReason: text('screening_reason'),
    dedupeFingerprint: varchar('dedupe_fingerprint', { length: 64 }),

    stillNeededAskedAt: timestamp('still_needed_asked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    renewedCount: integer('renewed_count').notNull().default(0),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index('requests_status_idx').on(t.status),
    communeIdx: index('requests_commune_idx').on(t.communeId),
    expiresIdx: index('requests_expires_idx').on(t.expiresAt),
    claimExpiresIdx: index('requests_claim_expires_idx').on(t.claimExpiresAt),
    dedupeIdx: index('requests_dedupe_idx').on(t.dedupeFingerprint),
  }),
);

/* ------------------------------------------------------------------ */
/* Trips — one donor, one journey, possibly several nearby requests.   */
/* ------------------------------------------------------------------ */

export const trips = pgTable(
  'trips',
  {
    id: serial('id').primaryKey(),
    donorPersonId: integer('donor_person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    status: tripStatusEnum('status').notNull().default('claimed'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    donorIdx: index('trips_donor_idx').on(t.donorPersonId),
    statusIdx: index('trips_status_idx').on(t.status),
  }),
);

export const tripRequests = pgTable(
  'trip_requests',
  {
    id: serial('id').primaryKey(),
    tripId: integer('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    requestId: integer('request_id')
      .notNull()
      .references(() => requests.id, { onDelete: 'cascade' }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    confirmedByCode: boolean('confirmed_by_code').notNull().default(false),
  },
  (t) => ({
    tripIdx: index('trip_requests_trip_idx').on(t.tripId),
    requestIdx: uniqueIndex('trip_requests_request_idx').on(t.requestId),
  }),
);

/* ------------------------------------------------------------------ */
/* Safety, moderation, audit                                           */
/* ------------------------------------------------------------------ */

export const contactReveals = pgTable('contact_reveals', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  requestId: integer('request_id')
    .notNull()
    .references(() => requests.id, { onDelete: 'cascade' }),
  revealedAt: timestamp('revealed_at', { withTimezone: true }).notNull().defaultNow(),
  ip: text('ip'),
  userAgent: text('user_agent'),
});

export const flags = pgTable(
  'flags',
  {
    id: serial('id').primaryKey(),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: integer('target_id').notNull(),
    reporterPersonId: integer('reporter_person_id').references(() => people.id),
    reason: text('reason'),
    // Weighted by reporter trust so new accounts cannot brigade a real request.
    reporterTrustWeight: integer('reporter_trust_weight').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    targetIdx: index('flags_target_idx').on(t.targetType, t.targetId),
  }),
);

export const reviews = pgTable('reviews', {
  id: serial('id').primaryKey(),
  targetType: varchar('target_type', { length: 32 }).notNull(),
  targetId: integer('target_id').notNull(),
  reviewerPersonId: integer('reviewer_person_id')
    .notNull()
    .references(() => people.id),
  decision: varchar('decision', { length: 16 }).notNull(), // keep | remove
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const trustEvents = pgTable('trust_events', {
  id: serial('id').primaryKey(),
  personId: integer('person_id')
    .notNull()
    .references(() => people.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 48 }).notNull(),
  delta: integer('delta').notNull(),
  sourceId: integer('source_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  actor: text('actor'),
  action: varchar('action', { length: 64 }).notNull(),
  targetType: varchar('target_type', { length: 32 }),
  targetId: integer('target_id'),
  metadata: text('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Runtime settings — kill switch and per-wilaya throttle.             */
/* Stored in the database so the operator can change them from the     */
/* dashboard without a redeploy, which matters at 3am.                 */
/* ------------------------------------------------------------------ */

export const settings = pgTable('settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
