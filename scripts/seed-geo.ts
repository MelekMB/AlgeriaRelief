/**
 * Seeds wilayas, communes and categories.
 *
 * Idempotent — upserts on the stable `code` column, so it is safe to re-run
 * after adding data.
 *
 *   npm run seed:geo
 *   npm run seed:geo -- --file ./communes.json
 *
 * The --file form replaces the pilot commune subset with a full dataset.
 * Expected shape: [{ wilayaCode, code, nameAr, nameFr, lat?, lng? }, ...]
 */
import { readFile } from 'node:fs/promises';
import { inArray, sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';
import { wilayas, communes, categories, requests } from '../src/db/schema.js';
import { WILAYAS } from '../src/data/wilayas.js';
import { COMMUNES, type SeedCommune } from '../src/data/communes.js';
import { CATEGORIES } from '../src/data/categories.js';

const DEFAULT_DATASET = 'data/communes.json';

async function loadCommunes(): Promise<SeedCommune[]> {
  const fileFlag = process.argv.indexOf('--file');

  if (fileFlag !== -1) {
    const path = process.argv[fileFlag + 1];
    if (!path) throw new Error('--file needs a path to a JSON file');
    return parseCommuneFile(await readFile(path, 'utf8'), path);
  }

  // The full national dataset ships in the repo. Only fall back to the
  // hand-written pilot subset if it is somehow missing, so that a bad deploy
  // degrades to "8 wilayas covered" rather than to nothing at all.
  try {
    return parseCommuneFile(await readFile(DEFAULT_DATASET, 'utf8'), DEFAULT_DATASET);
  } catch {
    console.warn(`No ${DEFAULT_DATASET} found - falling back to the pilot subset.`);
    return [...COMMUNES];
  }
}

function parseCommuneFile(raw: string, path: string): SeedCommune[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`${path} must contain a JSON array`);
  return parsed as SeedCommune[];
}

// Arbitrary but fixed key for the advisory lock.
const SEED_LOCK = 918273645;

async function main() {
  // Only one process may seed at a time. Autoscale boots several instances,
  // each running this on start; concurrent upserts on the same rows collide
  // and leave the table half-populated - which is exactly how one wilaya
  // ended up with no communes at all in production.
  const lockRows = (await db.execute(
    sql`select pg_try_advisory_lock(${SEED_LOCK}) as locked`,
  )) as unknown as Array<{ locked: boolean }>;

  if (!lockRows[0]?.locked) {
    console.log('Another process is already seeding - skipping.');
    process.exit(0);
  }

  console.log('Seeding wilayas…');
  await db
    .insert(wilayas)
    .values(WILAYAS.map((w) => ({ ...w })))
    .onConflictDoUpdate({
      target: wilayas.code,
      set: { nameAr: sql`excluded.name_ar`, nameFr: sql`excluded.name_fr` },
    });

  console.log('Seeding categories…');
  await db
    .insert(categories)
    .values(CATEGORIES.map((c) => ({ ...c })))
    .onConflictDoUpdate({
      target: categories.code,
      set: {
        nameAr: sql`excluded.name_ar`,
        nameFr: sql`excluded.name_fr`,
        icon: sql`excluded.icon`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  const rows = await loadCommunes();
  console.log(`Seeding ${rows.length} communes…`);

  const wilayaRows = await db.select({ id: wilayas.id, code: wilayas.code }).from(wilayas);
  const wilayaIdByCode = new Map(wilayaRows.map((w) => [w.code, w.id]));

  const values = rows.map((c) => {
    const wilayaId = wilayaIdByCode.get(c.wilayaCode);
    if (!wilayaId) throw new Error(`Unknown wilaya code "${c.wilayaCode}" for commune ${c.code}`);
    return {
      wilayaId,
      code: c.code,
      nameAr: c.nameAr,
      nameFr: c.nameFr,
      lat: (c as SeedCommune & { lat?: number }).lat ?? null,
      lng: (c as SeedCommune & { lng?: number }).lng ?? null,
    };
  });

  // Chunked so a full ~1,540-row import stays under parameter limits.
  const CHUNK = 200;
  for (let i = 0; i < values.length; i += CHUNK) {
    await db
      .insert(communes)
      .values(values.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: communes.code,
        set: {
          wilayaId: sql`excluded.wilaya_id`,
          nameAr: sql`excluded.name_ar`,
          nameFr: sql`excluded.name_fr`,
        },
      });
  }

  // Remove rows left over from an earlier, smaller dataset so the table
  // matches the file exactly. Anything a request still points at is kept:
  // losing a family's commune would orphan their request.
  const wanted = new Set(values.map((v) => v.code));
  const existing = await db.select({ id: communes.id, code: communes.code }).from(communes);
  const staleIds = existing.filter((r) => !wanted.has(r.code)).map((r) => r.id);

  if (staleIds.length > 0) {
    const inUse = new Set(
      (await db.select({ id: requests.communeId }).from(requests)).map((r) => r.id),
    );
    const removable = staleIds.filter((id) => !inUse.has(id));
    for (let i = 0; i < removable.length; i += CHUNK) {
      await db.delete(communes).where(inArray(communes.id, removable.slice(i, i + CHUNK)));
    }
    console.log(`Removed ${removable.length} stale commune(s) from an older dataset.`);
  }

  // Verify, and shout if any wilaya ended up with nothing: an empty dropdown
  // means people in that wilaya cannot post at all.
  const perWilaya = await db
    .select({ code: wilayas.code, n: sql<number>`count(${communes.id})::int` })
    .from(wilayas)
    .leftJoin(communes, sql`${communes.wilayaId} = ${wilayas.id}`)
    .groupBy(wilayas.code);

  const empty = perWilaya.filter((r) => Number(r.n) === 0).map((r) => r.code);
  const total = perWilaya.reduce((sum, r) => sum + Number(r.n), 0);

  console.log(
    `Done. ${WILAYAS.length} wilayas, ${CATEGORIES.length} categories, ${total} communes in the database.`,
  );

  if (empty.length > 0) {
    console.error(`WARNING: these wilayas have no communes: ${empty.join(', ')}`);
    process.exitCode = 1;
  }

  await db.execute(sql`select pg_advisory_unlock(${SEED_LOCK})`);

  if (process.argv.indexOf('--file') === -1) {
    console.warn(
      '\n⚠️  Pilot commune subset only (8 fire-prone wilayas). Import the full\n' +
        '   official dataset with `npm run seed:geo -- --file communes.json`\n' +
        '   before launching beyond a single-wilaya pilot.',
    );
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
