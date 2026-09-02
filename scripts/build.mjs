/**
 * Production build wrapper.
 *
 * Replit injects NODE_ENV=development into the workspace environment. With
 * that set, `next build` emits a development build: React resolves to a
 * mismatched copy and prerendering fails with either
 *   "Cannot read properties of null (reading 'useContext')"
 * or
 *   "<Html> should not be imported outside of pages/_document".
 *
 * Removing it from .replit is not enough because the value also comes from
 * the environment itself, so it is forced here. Written as a Node script
 * rather than `NODE_ENV=production next build` so it works on Windows too.
 */
import { spawnSync } from 'node:child_process';

process.env.NODE_ENV = 'production';

const result = spawnSync('next', ['build'], {
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status ?? 1);
