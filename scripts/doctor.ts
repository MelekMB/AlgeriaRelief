/**
 * Setup diagnostic.
 *
 *   npm run doctor
 *
 * Checks every precondition the request form depends on and says exactly
 * which one is missing. Run this first whenever something "just doesn't
 * work" — it is faster than reading logs.
 */
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';

const ok = (m: string) => console.log(`  ok    ${m}`);
const bad = (m: string, fix: string) => {
  console.log(`  FAIL  ${m}`);
  console.log(`        → ${fix}`);
  problems++;
};

let problems = 0;

async function main() {
  console.log('\nEnvironment');
  for (const [name, required] of [
    ['DATABASE_URL', true],
    ['SESSION_SECRET', true],
    ['ADMIN_PASSWORD', false],
    ['ABUSE_EMAIL', false],
  ] as Array<[string, boolean]>) {
    const value = process.env[name];
    if (value) {
      if (name === 'SESSION_SECRET' && value.length < 32) {
        bad('SESSION_SECRET is shorter than 32 characters', 'openssl rand -hex 32');
      } else ok(`${name} is set`);
    } else if (required) {
      bad(`${name} is missing`, `Add it in Replit → Tools → Secrets`);
    } else {
      console.log(`  warn  ${name} is not set (optional, but some features need it)`);
    }
  }

  if (!process.env.DATABASE_URL) {
    console.log('\nCannot check the database without DATABASE_URL.\n');
    process.exit(1);
  }

  console.log('\nDatabase connection');
  try {
    await db.execute(sql`select 1`);
    ok('connected');
  } catch (err) {
    bad(`cannot connect: ${(err as Error).message}`, 'Add the PostgreSQL module in Replit');
    process.exit(1);
  }

  console.log('\nTables');
  const expected = [
    'wilayas',
    'communes',
    'categories',
    'people',
    'otp_codes',
    'requests',
    'trips',
    'trip_requests',
    'contact_reveals',
    'flags',
    'reviews',
    'trust_events',
    'audit_log',
    'settings',
  ];

  const rows = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.tables where table_schema = 'public'`,
  );
  const present = new Set((rows as unknown as Array<{ table_name: string }>).map((r) => r.table_name));

  for (const table of expected) {
    if (present.has(table)) ok(`${table}`);
    else bad(`table "${table}" is missing`, 'npm run db:push');
  }

  if (problems > 0) {
    console.log(`\n${problems} problem(s). Fix the above, then run \`npm run doctor\` again.\n`);
    process.exit(1);
  }

  console.log('\nSeed data');
  for (const [table, min, fix] of [
    ['wilayas', 58, 'npm run seed:geo'],
    ['categories', 8, 'npm run seed:geo'],
    ['communes', 1, 'npm run seed:geo'],
  ] as Array<[string, number, string]>) {
    const res = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from ${sql.identifier(table)}`,
    );
    const n = Number((res as unknown as Array<{ n: number }>)[0]?.n ?? 0);
    if (n >= min) ok(`${table}: ${n} rows`);
    else bad(`${table} has ${n} rows, expected at least ${min}`, fix);
  }

  console.log('\nThe exact lookup the request form performs');
  const cat = await db.execute<{ id: number }>(
    sql`select id from categories where code = 'water_food' limit 1`,
  );
  if ((cat as unknown as Array<{ id: number }>).length > 0) {
    ok('category "water_food" resolves');
  } else {
    bad(
      'category "water_food" not found — this is what makes the form show "حدث خطأ"',
      'npm run seed:geo',
    );
  }

  console.log('\nOperator settings');
  const st = await db.execute<{ key: string; value: string }>(sql`select key, value from settings`);
  const settingsRows = st as unknown as Array<{ key: string; value: string }>;
  const readOnly = settingsRows.find((r) => r.key === 'read_only')?.value === '1';
  if (readOnly) {
    bad('read-only mode is ON — all posting is blocked', 'Turn it off at /admin');
  } else {
    ok('read-only mode is off');
  }
  const throttled = settingsRows.find((r) => r.key === 'throttled_wilayas')?.value;
  if (throttled) console.log(`  warn  throttled wilayas: ${throttled}`);

  console.log(
    problems === 0
      ? '\nALL CHECKS PASSED — the form should work. If it still fails, check the server log for a line starting with [submitRequest].\n'
      : `\n${problems} problem(s) found.\n`,
  );
  process.exit(problems === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nDoctor itself failed:', err);
  process.exit(1);
});
