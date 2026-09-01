/**
 * Maintenance worker.
 *
 * Runs alongside the web server on Replit Reserved VM. This is what makes
 * the claim lock work: without it a claimed request stays reserved forever
 * and never returns to the pool, dead requests never expire, and the board
 * quietly rots while looking healthy.
 *
 * It is a separate process rather than a Next.js instrumentation hook
 * because that hook is also compiled for the edge runtime, which cannot
 * load the Postgres driver.
 *
 *   npm run worker
 */
import { runMaintenance } from '../src/lib/jobs.js';

const INTERVAL_MS = Number(process.env.MAINTENANCE_INTERVAL_MS ?? 5 * 60 * 1000);

if (!process.env.DATABASE_URL) {
  console.error('[worker] DATABASE_URL is not set — refusing to start');
  process.exit(1);
}

async function tick() {
  try {
    const report = await runMaintenance();
    const touched =
      report.claimsReleased +
      report.requestsExpired +
      report.stillNeededSent +
      report.unansweredHidden;
    if (touched > 0) console.log('[worker]', new Date().toISOString(), report);
  } catch (err) {
    // A failed sweep must never kill the loop — survive a database blip and
    // try again on the next tick.
    console.error('[worker] maintenance failed', err);
  }
}

console.log(`[worker] started, every ${Math.round(INTERVAL_MS / 1000)}s`);
void tick();
setInterval(tick, INTERVAL_MS);
