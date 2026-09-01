import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. On Replit, add the PostgreSQL module and it is provided automatically.',
  );
}

// Reserved VM keeps one long-lived process, so a small pool is correct here.
const client = postgres(connectionString, { max: 5 });

export const db = drizzle(client, { schema });
export { schema };
