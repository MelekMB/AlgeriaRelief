/**
 * Production start.
 *
 * Runs three things in order:
 *   1. Seed the reference data (wilayas, communes, categories).
 *   2. Start the maintenance worker in the background.
 *   3. Start the web server in the foreground.
 *
 * Why seed on every boot: a Replit deployment gets its own production
 * database, separate from the workspace one. Seeding the workspace by hand
 * leaves the deployed app with empty dropdowns — the town selector comes back
 * as `{"communes":[]}` and nobody can post a request. The seed upserts on a
 * stable code, so re-running it is cheap and harmless.
 *
 * A failed seed is logged but does not stop the server: serving a degraded
 * app beats serving nothing during a fire.
 */
import { spawn, spawnSync } from 'node:child_process';

process.env.NODE_ENV = 'production';

console.log('[start] seeding reference data...');
const seed = spawnSync('npm', ['run', 'seed:geo'], { stdio: 'inherit', shell: true });
if (seed.status !== 0) {
  console.warn('[start] seed failed — continuing anyway. Dropdowns may be empty.');
}

console.log('[start] starting maintenance worker...');
const worker = spawn('npm', ['run', 'worker'], { stdio: 'inherit', shell: true });
worker.on('exit', (code) => console.warn(`[start] worker exited with code ${code}`));

console.log('[start] starting web server...');
const web = spawnSync('next', ['start', '-H', '0.0.0.0'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

worker.kill();
process.exit(web.status ?? 1);
