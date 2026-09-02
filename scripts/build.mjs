/**
 * Production build wrapper.
 *
 * Two jobs, both defensive:
 *
 * 1. Force NODE_ENV=production. Replit injects NODE_ENV=development into the
 *    workspace environment (not only via .replit), and with that set
 *    `next build` emits a development build: React resolves to a mismatched
 *    copy and prerendering fails with either
 *      "Cannot read properties of null (reading 'useContext')"
 *    or
 *      "<Html> should not be imported outside of pages/_document".
 *
 * 2. Delete .next first. A directory left behind by a previous dev-mode or
 *    half-finished build makes the next one fail with unrelated-looking
 *    errors such as "Cannot read properties of undefined (reading 'length')".
 *    Deploy builds should be deterministic, so always start clean.
 *
 * Written as a Node script rather than `NODE_ENV=production next build` so it
 * works on Windows as well as Replit.
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';

process.env.NODE_ENV = 'production';

try {
  rmSync('.next', { recursive: true, force: true });
  console.log('[build] cleared .next');
} catch (err) {
  console.warn('[build] could not clear .next:', err);
}

const result = spawnSync('next', ['build'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
