# Algeria Wildfire Relief

Crisis-response web app connecting people who need help with donors who **deliver directly** to them. Arabic + French, mobile-first, built to run with no moderation staff.

Full product plan: `C:\Users\melek\Downloads\SOP-SNAP\01-Documents\Algeria-Wildfire-Relief-Product-Plan.md`

---

## ⚠️ Two things that must not be changed casually

**1. Deployment target must stay Reserved VM.**
`.replit` sets `deploymentTarget = "vm"`. On Autoscale, work that continues after a response is sent gets throttled or killed — a failure mode already confirmed on this account. The claim-lapse sweeper, the 72h expiry job and the 24h "Still needed?" SMS all depend on background execution and would silently stop running. The app would look fine and quietly rot.

**2. Emergency numbers are unverified.**
`src/config/emergency.ts` ships working defaults with `EMERGENCY_VERIFIED = false`. Confirm every number against an authoritative Algerian source before launch. A wrong number in an emergency app is the worst bug this codebase can ship.

---

## Running on Replit

1. Import this repo into Replit.
2. Add the **PostgreSQL** module — `DATABASE_URL` is then provided automatically.
3. Add Secrets from `.env.example` (at minimum `SESSION_SECRET`, `ADMIN_PASSWORD`, `ABUSE_EMAIL`).
4. `npm install`
5. `npm run db:push` — creates the schema
6. `npm run seed:geo` — seeds wilayas, communes and categories
7. Run. Deploy as **Reserved VM**.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — it redirects to `/ar` (Arabic is the default locale; French is at `/fr`).

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server, bound to 0.0.0.0 for Replit's proxy |
| `npm run build` / `npm start` | Production build and serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Push the Drizzle schema to Postgres |
| `npm run seed:geo` | Seed wilayas / communes / categories |

---

## Architecture notes

- **Next.js 15 App Router**, server-rendered so the list is readable before any JS executes. Target: under 100KB first meaningful paint.
- **next-intl** with route-based locales (`/ar`, `/fr`). Every URL is unambiguous and shareable into WhatsApp/Facebook — that share loop is the growth plan.
- **RTL is handled by CSS logical properties only.** If a component needs a `[dir="rtl"]` override to look right, it is using a physical property and should be fixed instead. The single legitimate exception is `.rtl-mirror` for directional icons.
- **Western Arabic numerals (0-9) in both locales.** Maghreb convention differs from the Mashriq; Eastern Arabic numerals read as foreign to Algerian users.
- **Drizzle + postgres-js**, small pool since Reserved VM is one long-lived process.
- **No Supabase, so no Row Level Security.** Address and phone reveal must be enforced in one server-side accessor that every read path goes through. No component may touch the raw column directly.

## Security invariants

These are load-bearing. Breaking one breaks the trust model:

- **No money anywhere.** No payment fields, no donation collection, and submissions containing IBAN/RIB/RIP/CCP/BaridiMob/crypto/payment-domain patterns are rejected at submit. This is what removes the fraud incentive.
- **Address and phone are never public** — not in a list, not in search, not in an API response. Revealed only to one phone-verified donor holding an active claim, and logged.
- **The claim lock is the anti-waste mechanic.** One open trip per donor; claiming reserves a request for 6h and hides it from everyone else; lapse auto-returns it to the pool.
- **Serial claiming is the main attack** (harvesting addresses without ever delivering). No-show tracking throttles then suspends.
- **Everything fails closed.** Quarantined content stays hidden if nobody reviews it, and expires. Silence never publishes.
- **Strip EXIF from every uploaded photo.** A geotagged photo of a damaged home defeats the whole location-privacy design.

---

## Status

**Built and verified** (`npm run typecheck`, `npm test`, `npm run build` all green)
- Project scaffold, Replit config (Reserved VM), Tailwind v4 design tokens with light/dark
- AR/FR routing with `dir`/`lang` per locale — confirmed in the prerendered HTML
- Full database schema (people, OTP, requests with claim-lock fields, trips, flags, reviews, trust events, audit log)
- Home page: two doors, emergency banner, safety rules, language toggle
- Seed data: 58 wilayas, 8 categories, ~130 communes across the 8 fire-prone wilayas
- Crypto layer: AES-256-GCM for phone/address at rest, HMAC-signed session cookies, peppered hashing, lazy key derivation so a fresh import builds before secrets exist
- Algerian mobile parsing — handles `0555…`, `+213…`, `00213…`, bare `5…`, and the country-code-plus-trunk-zero shape people actually type; rejects landlines and foreign numbers
- Phone OTP: 6-digit codes, hashed at rest, 10-min TTL, 5 attempts, 1/min and 5/hour caps
- SMS adapter with Twilio + no-provider dev mode (never echoes codes in production)
- **Screening**: payment-rail blocklist (IBAN, RIB/RIP, CCP, BaridiMob, Western Union, crypto, payment domains, AR/FR money solicitation incl. Arabic-Indic digits), contact-leak shadowing, and dedupe fingerprinting robust to diacritics, accents and attached/detached Arabic conjunctions

**Not yet exercised against a live database.** The seed script, OTP and person upsert are written and typecheck clean, but nothing has run against Postgres — there is no local instance. First real test is on Replit after `db:push` + `seed:geo`.

**Next, in order**
1. Post a request — 5 fields, delivery point (home vs landmark), under 60 seconds
2. Browse needs — distance-first, filters, no login
3. **Claim lock** — reserve 6h, reveal address, countdown, auto-return on lapse
4. Batch nearby, then 4-digit delivery confirmation
5. LLM screening pass (Haiku) layered on top of the deterministic rules
6. Flags → auto-quarantine, community review queue
7. Background jobs: claim-lapse sweeper, expiry, "Still needed?" SMS
8. Operator dashboard: quarantine, counters, per-wilaya throttle, kill switch
9. SMS deliverability test to a real `+213` number — **do this before step 3 ships**
