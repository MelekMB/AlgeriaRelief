/**
 * Production start.
 *
 * Order matters here:
 *   1. Start the web server IMMEDIATELY, on the port the platform asks for.
 *   2. Seed reference data in the background.
 *   3. Start the maintenance worker in the background.
 *
 * The web server must come first because Replit health-checks the port within
 * seconds of boot and kills the deployment if nothing answers. Seeding ~180
 * rows is fast but not instant, and blocking the server behind it was enough
 * to fail the check ("context deadline exceeded") and get the container
 * terminated in a loop.
 *
 * Seeding on every boot is deliberate: a Replit deployment gets its own
 * production database, separate from the workspace, so seeding by hand leaves
 * the live app with empty dropdowns. The seed upserts on a stable code, so
 * re-running it is cheap and harmless.
 */
import { spawn, spawnSync } from 'node:child_process';

process.env.NODE_ENV = 'production';

// Bind to the platform's port. Replit health-checks a port it chooses, and a
// hardcoded 3000 means the check hits nothing and the deploy is killed.
const port = process.env.PORT || '3000';

console.log(`[start] web server on port ${port}`);
const web = spawn('next', ['start', '-H', '0.0.0.0', '-p', port], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

// Background work, none of it allowed to delay or crash the server.
const background = [];

setTimeout(() => {
  console.log('[start] seeding reference data...');
  const seed = spawnSync('npm', ['run', 'seed:geo'], { stdio: 'inherit', shell: true });
  if (seed.status !== 0) {
    console.warn('[start] seed failed - continuing. Dropdowns may be empty.');
  }

  console.log('[start] starting maintenance worker...');
  const worker = spawn('npm', ['run', 'worker'], { stdio: 'inherit', shell: true });
  worker.on('exit', (code) => console.warn(`[start] worker exited with code ${code}`));
  background.push(worker);
}, 1000);

const shutdown = () => {
  for (const child of background) child.kill();
  web.kill();
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

web.on('exit', (code) => {
  for (const child of background) child.kill();
  process.exit(code ?? 1);
});
