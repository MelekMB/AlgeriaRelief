# Algeria Wildfire Relief

A crisis web app that connects people who need help with donors who **deliver directly** to them. Arabic + French, mobile-first, built to run with no moderation staff.

- Product plan: `docs/PRODUCT-PLAN.md`
- Working log: `docs/SESSION-RECORD.md`

---

## ⚠️ Three things to settle before real users arrive

**1. Verify the emergency numbers.**
`src/config/emergency.ts` ships working defaults with `EMERGENCY_VERIFIED = false`. Confirm all four against an authoritative Algerian source, then set the flag to `true`. A wrong number in an emergency app is the worst bug this codebase can ship.

**2. Deployment target must be Reserved VM, not Autoscale.**
`.replit` sets `deploymentTarget = "vm"`. The maintenance worker runs as a second process alongside the web server; on Autoscale it is throttled or killed. Claims would never lapse, dead requests would never expire, and the board would rot while looking healthy.

**3. Test SMS delivery to a real `+213` number.**
Set `SMS_PROVIDER=twilio` with credentials and send yourself a code. If delivery fails, the app still works — unverified posts are published but ranked below verified ones and cannot claim or reveal anyone's contact details — but you should know which mode you are launching in.

---

## Deploying to Replit via GitHub

**1. Push this repo to GitHub**

```bash
git remote add origin https://github.com/<you>/algeria-relief.git
git branch -M main
git push -u origin main
```

**2. On Replit:** Create Repl → **Import from GitHub** → pick the repo.

**3. Add the PostgreSQL module** (Tools → Database). `DATABASE_URL` is then injected automatically.

**4. Add Secrets** (Tools → Secrets):

| Secret | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | **yes — the app cannot post without it** | 64 hex chars. Generate: `openssl rand -hex 32`. Used to encrypt addresses and phone numbers at rest and to sign session cookies. |
| `ADMIN_PASSWORD` | recommended | Unlocks `/admin`: the kill switch, the per-wilaya throttle, and the quarantine queue. Leave it unset and `/admin` is permanently inaccessible — safe, but you lose the emergency stop. |
| `ABUSE_EMAIL` | recommended | The address shown on `/abuse` for reporting scams and dangerous listings. With no moderators, this is the only way anyone can reach a human. Leave it unset and the page still explains how to report, just without an email. |
| `SMS_PROVIDER` | no | `none` (default) or `twilio` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM` | if twilio | |
| `ANTHROPIC_API_KEY` | no | Reserved for the LLM screening pass; deterministic rules run without it |
| `CLAIM_WINDOW_HOURS` | no | Default 6. Tune from pilot data. |
| `REQUEST_TTL_HOURS` | no | Default 72 |

**5. First-run setup** in the Replit shell:

```bash
npm install && npm run db:push && npm run seed:geo && npm run smoke
```

`npm run smoke` is the important one — it exercises the claim lock, the address-reveal boundary, delivery confirmation and the lapse sweeper against the real database, then deletes its own test rows. **Do not launch if it does not print `ALL PASS`.**

**6. Deploy** → Reserved VM. The run command starts the worker and the web server together.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on 0.0.0.0 |
| `npm run build` | Production build |
| `npm start` | Worker + web server (production) |
| `npm run start:web` | Web server only (use on Windows) |
| `npm run worker` | Maintenance loop only |
| `npm test` | Phone/crypto, screening, and locale-parity suites |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Push schema to Postgres |
| `npm run seed:geo` | Seed wilayas / communes / categories |
| `npm run smoke` | End-to-end test against the real database |

---

## How it works

**Requester:** two-door home → category → wilaya/commune → description → deliver to home or meet at a landmark → phone → OTP → published for 72h. Manage or close it at `/my-request`.

**Donor:** browse without login → **"I'll deliver this"** → OTP → the request locks to them for 6h and disappears from everyone else's list → address and phone revealed → drive → the receiver reads a **4-digit code** at the door to confirm.

**The claim lock is the point.** Without it everyone opens the app, sees the same top request, and five cars arrive at one house while four other families get nobody — worse than the WhatsApp groups this replaces.

**Moderation runs itself.** Flags are weighted by reporter trust, so a brigade of fresh numbers cannot bury a real request. Three weighted points auto-quarantines. Trusted users (verified + 2 confirmed exchanges + clean record) can review. If nobody reviews, the item stays hidden and expires — silence never publishes.

**The operator has one job:** watch the abuse inbox, and pull the kill switch at `/admin` if things go wrong.

---

## Architecture notes

- **Next.js 15 App Router**, server-rendered so the list is readable before any JS executes.
- **next-intl**, route-based locales (`/ar`, `/fr`). Every URL is shareable into WhatsApp/Facebook — that share loop is the growth plan.
- **RTL via CSS logical properties only.** If a component needs a `[dir="rtl"]` override, it is using a physical property and should be fixed. The one exception is `.rtl-mirror` for directional icons.
- **Western Arabic numerals (0-9) in both locales** — Maghreb convention, not Mashriq.
- **Drizzle + postgres-js**, small pool because Reserved VM is one long-lived process.
- **The worker is a separate process**, not a Next.js instrumentation hook — that hook is also compiled for the edge runtime, which cannot load the Postgres driver.

## Security invariants

Breaking any one of these breaks the trust model:

- **No money anywhere.** No payment fields, and submissions containing IBAN/RIB/RIP/CCP/BaridiMob/Western Union/crypto/payment-domain patterns or AR/FR money solicitation are rejected at submit. Removing the payment rail is what removes the fraud incentive.
- **Address and phone are never public.** Not in a list, not in search, not in an API response. `src/lib/requests.ts` is the security boundary: `getRequestForClaimant` is the only place they are decrypted. Never add those columns to a list projection.
- **One open trip per donor**, and serial claiming without delivering increments `noShowCount` — that is the defence against harvesting addresses.
- **Everything fails closed.** Quarantined content stays hidden if nobody reviews it.
- **Strip EXIF from any photo upload** (not yet built — see below).

---

## Status

**Working and verified** — `npm run typecheck`, `npm test` (3 suites), `npm run build` all green; AR RTL and FR LTR confirmed in a real browser and in the prerendered HTML.

Post a request · phone OTP · donor sign-in · browse with filters · request detail · **claim lock** · batch nearby · gated address reveal · tap-to-call and WhatsApp · 4-digit delivery confirmation · close/renew your own request · flag → auto-quarantine · admin dashboard with kill switch and per-wilaya throttle · public delivery ledger · privacy and abuse pages · maintenance worker (claim lapse, expiry, "still needed?" ping) · locale parity gate.

**Verified against a live database on Replit.** `npm run doctor` all green (14 tables, 58 wilayas, 8 categories, 120 communes) and `npm run smoke` **ALL PASS** — the claim lock holds under contention, a second donor is denied the address, a wrong door code is rejected, and the sweeper returns lapsed claims and records no-shows. The production build succeeds there too (26 pages).

### If the Replit build fails
Three environment problems, all already handled in this repo — but worth knowing:
- **Never press "Fix with Agent".** The Replit Agent once rewrote this repo unprompted (a whole parallel Vite + shadcn app under `artifacts/`, plus edits to `.replit`) and broke it. Recover with `git branch backup && git reset --hard origin/main && git clean -fd`.
- **`git pull` refuses because `.replit` changed.** Replit rewrites that file on publish. Run `git checkout -- .replit` first.
- **`NODE_ENV`.** Replit injects `NODE_ENV=development` into the environment, which makes `next build` emit a development build and fail while prerendering. `scripts/build.mjs` forces production and clears `.next` first; do not bypass it by calling `next build` directly.

**Not built yet**
1. LLM screening pass (Haiku) on top of the deterministic rules
2. Photo upload with EXIF stripping
3. Per-commune "Needed now / Saturated" board
4. Community review queue UI (the logic in `src/lib/flags.ts` is written and tested by type only; admin can already keep/remove)
5. Contact-reveal daily quotas
6. Honeypot listings
7. Full commune dataset — `src/data/communes.ts` covers 8 fire-prone wilayas only; import the rest with `npm run seed:geo -- --file communes.json`
