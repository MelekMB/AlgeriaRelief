import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type Db = PostgresJsDatabase<typeof schema>;

let instance: Db | null = null;

function getDb(): Db {
  if (instance) return instance;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. On Replit, add the PostgreSQL module and it is provided automatically.',
    );
  }

  // Reserved VM keeps one long-lived process, so a small pool is correct here.
  instance = drizzle(postgres(connectionString, { max: 5 }), { schema });
  return instance;
}

/**
 * Connects on first query rather than on import.
 *
 * `next build` collects page data by importing every route, so throwing at
 * module load would make a fresh Replit import fail to build before the
 * database has been attached — a confusing first-run error for something
 * that is only needed at request time.
 */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getDb() as object, prop, receiver);
    return typeof value === 'function' ? value.bind(getDb()) : value;
  },
});

export { schema };
