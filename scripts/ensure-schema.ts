/**
 * Bring the database up to date, idempotently.
 *
 *   npm run db:ensure
 *
 * Why this exists: a Replit deployment has its own production database,
 * separate from the workspace one. Running `npm run db:push` in the Shell
 * only touches the workspace, so a newly added column is missing in
 * production and the app throws a server-side exception the moment someone
 * posts. That is exactly what happened with `requests.manage_code`.
 *
 * Every statement here is written to be safe to run on every boot: IF NOT
 * EXISTS throughout, no data touched, no destructive changes. It is not a
 * replacement for real migrations - it is the small, safe subset that lets a
 * deployment repair its own schema without anyone holding a production
 * connection string.
 */
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index.js';

const statements: Array<{ what: string; run: () => Promise<unknown> }> = [
  {
    what: 'requests.manage_code',
    run: () =>
      db.execute(sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS manage_code varchar(8)`),
  },
  {
    what: 'requests.confirm_code',
    run: () =>
      db.execute(sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS confirm_code varchar(8)`),
  },
  {
    what: 'requests.still_needed_asked_at',
    run: () =>
      db.execute(
        sql`ALTER TABLE requests ADD COLUMN IF NOT EXISTS still_needed_asked_at timestamptz`,
      ),
  },
  {
    what: 'people.no_show_count',
    run: () =>
      db.execute(
        sql`ALTER TABLE people ADD COLUMN IF NOT EXISTS no_show_count integer NOT NULL DEFAULT 0`,
      ),
  },
  {
    what: 'settings table',
    run: () =>
      db.execute(sql`
        CREATE TABLE IF NOT EXISTS settings (
          key varchar(64) PRIMARY KEY,
          value text NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `),
  },
];

let failures = 0;

for (const statement of statements) {
  try {
    await statement.run();
    console.log(`[schema] ok: ${statement.what}`);
  } catch (err) {
    failures++;
    console.error(`[schema] FAILED: ${statement.what}`, err);
  }
}

console.log(
  failures === 0
    ? '[schema] database is up to date'
    : `[schema] ${failures} statement(s) failed - see above`,
);

process.exit(failures === 0 ? 0 : 1);
