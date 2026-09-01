# Algeria Wildfire Relief — Product Plan (MVP)

**Date:** 2026-08-31
**Context:** Crisis-response web app connecting people who need help with people who can help, in Algeria, during wildfire events.
**Constraints:** ASAP delivery, small team, low budget, mobile-first, Arabic + French (RTL), **no registered partner association, no moderation staff — must run near-autonomously.**

---

## Operating premise

"Fully autonomous" is not achievable in this domain, but **"no staff required" is.** Routine moderation is eliminated structurally. What cannot be eliminated is one reachable human for legal/abuse escalation (one monitored email, ~10 min/week).

**Core fraud strategy: remove what is worth stealing.** No money touches the platform, no payment details are permitted in any field, precise locations stay private until both sides are phone-verified, and every listing self-destructs in 72 hours.

---

# PART A — Core platform

## 1. Problem Definition

- Help and need both exist in abundance but discover each other through fragmented Facebook groups, WhatsApp chains and phone trees. Information is unstructured, un-geocoded, duplicated, and never closed.
- Platform solves: structured, geographically-scoped, time-bounded matching, with enough trust signal that strangers will act.
- Explicitly NOT solving: emergency rescue (Protection Civile), money movement, official aid logistics, medical triage.
- **Assumption:** no official body sanctions or operates this. It is a civic utility, not an aid organization.

## 2. Users and Context Challenges

- **Requesters** — displaced families, people sheltering, elderly/isolated residents. Need: post in <60s on a phone, in AR or FR, without an account. Fear: exposing address, vulnerability, phone number.
- **Helpers/Donors** — people with a car, spare room, water, feed, medical skills, free hands. Need: see what is needed near me, now, that I can actually do. Fear: a wasted 40km trip.
- **Operators** — no staff. Role reduces to watching an abuse inbox and pulling a kill switch.

**Algeria-specific challenges**
- Geography: fires concentrate in northern forested wilayas (Bejaia, Tizi Ouzou, Jijel, Skikda, Setif, Bouira, El Tarf, Blida). Mountain communes have poor road access and patchy coverage. **Wilaya + commune must be the geographic primitive** — free text fragments the dataset instantly.
- Connectivity: 3G/4G with real dead zones, capped data. Usable at ~50KB, tolerant of dropped connections mid-submit.
- Incumbent channels: WhatsApp and Facebook already own coordination behaviour. **Feed them** — every listing produces a clean copy-pasteable share string.
- Language: MSA + French UI; free text will be Darija and Arabizi. Search and moderation must tolerate this.
- Devices: low battery, borrowed and shared phones. Never require a persistent login to browse.

**Unvalidated risks to check on day 1**
- SMS A2P deliverability to +213 (Djezzy / Ooredoo / Mobilis) — largest technical risk.
- Emergency service numbers must be re-confirmed from an authoritative source before display. Do not ship from memory.

## 3. Core Product Concept

Public, read-without-login, phone-verified bulletin board scoped to wilaya and commune.

- **Request** = category + commune + urgency + free text + optional photo + delivery point (home or landmark), 72-hour lifespan.
- **Donors deliver directly to a named receiver.** No hubs, no intermediary transporter — see PART B.
- **Matching is human, assisted by ranking.** No opaque auto-assignment. The system's job is to put the right 10 items in front of you, in order.
- **Address and contact are never public.** Revealed only to a phone-verified donor who has claimed the request, and logged.
- **The claim lock is the central mechanic.** Claiming reserves a request for 6h and hides it from everyone else — this is what stops duplicate trips and wasted time.

**Ranking (deterministic, transparent, no ML)**
1. Distance (same commune -> adjacent -> same wilaya -> national)
2. Urgency tier (capped, anti-inflation)
3. Verification tier (verified always above unverified)
4. Age ascending within tier (oldest unmet first, prevents starvation)
5. Vulnerability flags as a soft boost, never a public label

## 4. Key User Flows

**A. Requesting help (<60s, ~5 taps)**
1. Homepage, language auto-detected, prominent AR/FR toggle
2. **Emergency interstitial first** — "Is someone's life in immediate danger?" Yes -> official emergency numbers, tap-to-call, stop. Non-negotiable, before the form.
3. Category (icon grid: shelter, food/water, transport, clothing, medicine, livestock feed, hands/labour, other)
4. Wilaya -> commune (searchable, seeded)
5. Free text (~300 chars) + optional photo + urgency + beneficiary (self/family/neighbour)
6. Phone -> OTP -> posted. **No account, no password, no email.** The phone number IS the identity.
7. Confirmation: request ID, "expires in 72h", renew link, close button, safety rules

**B. Donating / delivering (direct)**
1. Browse with no login; filter by wilaya/commune + category, sorted distance-first
2. Cards show category, commune, distance, relative time, urgency, verification badge
3. **"I'll deliver this"** -> phone OTP (remembered ~30 days) -> request locks to this donor for 6h and disappears from other donors' lists
4. Address + phone revealed -> tap-to-call + pre-filled WhatsApp deep link; countdown visible to both sides
5. "3 more needs within 2km — add to this trip?" (batch, still counts as one trip)
6. At the door: receiver reads a **4-digit code**, donor enters it -> delivered, trust scores updated both sides
7. Lapsed claim -> auto-returns to the pool, receiver notified

**C. Operator (near zero-touch)**
- No routine queue. One dashboard: auto-quarantined items, abuse inbox, counters, **global kill switch** + per-wilaya throttle.
- Community moderation replaces staffing. Trusted users (verified + 2 confirmed completions + no upheld flags) unlock a review queue. Three concordant reviews auto-resolve. Reviewers never see contact details.
- **Everything fails closed.** If nothing is reviewed, quarantined content stays hidden and expires. Silence never publishes.

## 5. MVP Features (core platform)

Browse without login; AR/FR with full RTL; post request (OTP, no account) with delivery-point choice; wilaya+commune taxonomy; ~8 fixed categories; distance-first ranked list + filters; **claim lock** (6h reservation, one open trip per donor, auto-return on lapse); **batch nearby**; **gated address + contact reveal** after claim, logged and mutual; **4-digit delivery confirmation**; 72h auto-expiry + renew + close + "Still needed?" SMS at 24h; automated screening on submit; duplicate detection and merge; flag -> weighted threshold -> **auto-quarantine**; trust score + verification badges; rate limits per phone/device/IP + no-show throttling; emergency interstitial + persistent banner; safety rules at the moment of reveal; WhatsApp/copy share string; abuse-report email + takedown path; operator dashboard; audit log.

**Deliberately excluded from MVP:** standing offers, collection points, transporter role, public map, chat, password accounts, donations/payments, document upload, star ratings, push notifications, organization accounts.

## 6. Future Features

- **Weeks 3-6:** SMS/WhatsApp alerts for matching requests; commune-level heat density (aggregate counts, never pins); saved searches; "still needed?" ping before expiry; public stats page.
- **Later:** PWA offline browse + queued submit; USSD/SMS-in posting; verified organization accounts once partners exist; multi-crisis mode via `crisis_event` scope; Darija UI locale; supply-side route aggregation.
- **Never:** in-app payments or donation collection; public precise geolocation of vulnerable people; identity-document upload.

## 7. Trust, Safety, and Verification — five automated layers, each failing safe

**Layer 1 — Remove the incentive (strongest)**
- Zero money on the platform, enforced technically. Auto-reject submissions containing IBAN/RIB/RIP patterns, CCP formats, BaridiMob / Western Union / MoneyGram references, crypto addresses, payment or donation domains. Blocked at submit with an explanation in the user's language.
- Every contact-reveal screen: **"This platform never asks for money. Never send money to anyone you meet here."** Tap to proceed.
- Rationale: charity fraud runs on payment rails. With no rail and no way to advertise one, expected return drops below the effort of registering a phone number.

**Layer 2 — Cost of identity**
- Phone OTP to post or reveal contact. One number, one identity.
- Validate +213 and legitimate Algerian mobile prefixes; reject VoIP/disposable ranges.
- Hard caps: **1 open request per number** (second requires closing the first); offers capped at 3; contact reveals capped per day, scaling with trust.
- Device fingerprint + IP velocity limits catch multi-SIM attackers.
- **SMS-failure fallback:** allow unverified posting, marked clearly, ranked below all verified content, blocked from contact reveal until verified. Throughput preserved, trust not laundered.

**Layer 3 — Automated screening at submit**
- Deterministic blocklist first: payment patterns, external links, phone numbers in body text, abusive terms in AR/FR/Darija.
- Then one **LLM classification call** (Haiku-class, ~$0.0002 each) returning `scam_likelihood`, `is_genuine_need`, `contains_pii`, `is_abusive`, `detected_language`, `normalized_summary`. Must handle Arabic, French, Darija, Arabizi — why an LLM beats regex here.
  - High -> blocked with reason; Mid -> published but shadow-ranked, queued for community review; Low -> published normally.
- **Duplicate detection:** fingerprint on normalized text embedding + commune + category + phone. Near-matches prompt merge.

**Layer 4 — Community as the moderator**
- Flag button everywhere. **Flags weighted by flagger trust** — a brigade of new accounts cannot suppress a legitimate request; one trusted flagger acts fast.
- Weighted threshold -> automatic quarantine (hidden immediately, reversible). Bias toward hiding fast, restoring on review.
- Trusted users review; three concordant reviews decide. No staff.
- Trust earned only through **two-sided confirmed completions** — cannot be self-declared, bought, or farmed without a real counterparty.

**Layer 5 — Contain the damage**
- Contact reveals quotaed and logged; a scraper hits a wall in minutes.
- **Honeypot listings** with dedicated tracking numbers — any contact identifies a scraper, account auto-suspended. Cheapest high-signal abuse detector available.
- **Anti-urgency-inflation:** "critical" capped at 1 per number per 24h with a concrete reason required.
- **Circuit breakers:** if post rate, flag rate or block rate exceeds rolling baseline by a set multiple, auto-throttle that wilaya to read-only and email the operator.
- **Auto-expiry is itself an anti-fraud control** — no fraudulent listing survives 72 hours.

**Honest limit:** this stops opportunistic and low-effort fraud, the overwhelming majority. A determined adversary with many SIMs will get through. Mitigation is that with no payment rail there is nothing at the end worth having.

## 8. Bilingual and Localization Requirements

**Structure**
- Two locales: `ar` (RTL), `fr` (LTR). Route-based `/ar/...` `/fr/...` — indexable, shareable, unambiguous.
- UI strings in flat JSON per locale, namespaced per page. **CI fails the build on a missing key** — never silently render French inside an Arabic page.
- **User content is never translated.** Store `body` + `content_lang`. Render free text in a `dir="auto"` wrapper so Darija displays correctly inside a French page.
- Language persists in a cookie. Toggle visible on every screen, in the target language ("العربية" / "Français"), never a flag icon.
- Categories, wilayas, communes stored as **stable codes** with both display names in a lookup table. Never store a translated string as a key.

**RTL as architecture, not styling**
- `dir` and `lang` on `<html>` per locale; everything inherits.
- **CSS logical properties only:** `margin-inline-start`, `padding-inline-end`, `border-inline-start`, `inset-inline-start`, `text-align: start`. Lint-ban `left`/`right` — this is what makes RTL free rather than a second stylesheet.
- Tailwind: `ms-*`/`me-*`/`ps-*`/`pe-*`, never `ml-*`/`mr-*`.
- **Selective icon mirroring:** directional icons (back, next, progress) mirror; checkmarks, clocks, phone, camera, logos, media controls do NOT. Explicit `.rtl-mirror` class, never a blanket flip.
- **Bidi is where these apps actually break.** Wrap phone numbers, quantities, IDs and times in `<bdi>` or `unicode-bidi: isolate`. Test "اتصل على 0555 12 34 56" and "3 ماء / 2 خبز".
- **Numerals: Western Arabic digits (0-9) throughout, including the Arabic UI.** Maghreb convention differs from Mashriq; Eastern Arabic numerals would read as foreign. Set explicitly.
- **Typography:** IBM Plex Sans Arabic or Noto Sans Arabic, self-hosted and subset; `line-height` ~15% higher for Arabic; no font-synthesized bold. Arabic text is wider — test layouts at Arabic string lengths, not French.
- Forms: labels, errors, placeholders, validation all mirror; input `dir` follows expected content (phone fields stay LTR).
- Dates and relative times via `Intl`, not hand-rolled.

## 9. Technical Architecture

Optimized for 1-3 developers, days not months, near-zero fixed cost.

| Layer | Recommendation | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind | SSR = fast on 3G; route-based i18n; one codebase |
| i18n | next-intl | Route locales, RTL-aware, minimal config |
| Backend | Next.js route handlers / server actions | No separate service to run |
| Database | **Replit PostgreSQL** (Neon-backed; `DATABASE_URL` provided automatically) | Relational fits exactly; PostGIS later if maps arrive |
| ORM | Drizzle + postgres-js | Light, matches the stack already used on this account |
| Auth | **Custom phone OTP** (hashed codes in Postgres + signed httpOnly cookie) | No Supabase in this stack; no password flows to build either |
| SMS | Twilio / Vonage / MessageBird — **test all three vs +213 on day 1** | Deliverability is the top unvalidated risk |
| Hosting | **Replit Reserved VM** (`deploymentTarget = "vm"`) | **NOT Autoscale** — see the warning below |
| Media | Replit Object Storage | Resize + strip EXIF server-side |
| Screening | Claude Haiku single-call classifier | AR/FR/Darija; ~$0.0002/submission |
| Notifications | MVP: none. Post-MVP: SMS + WhatsApp deep links | Push adds complexity for little crisis value |
| Admin | One password-protected Next.js route | An admin framework is overkill for one dashboard |
| Monitoring | Sentry (free) + cron for circuit breakers | Auto-throttle needs a heartbeat |

- **Reserved VM, never Autoscale.** Autoscale throttles or kills work that continues after a response is sent — a failure mode already confirmed on this account in a prior project. The claim-lapse sweeper, the 72h expiry job and the 24h "Still needed?" SMS all depend on background execution and would silently stop. `.replit` carries this warning inline so it survives a future edit.
- Without Supabase there is no Row Level Security, so **address and phone reveal must be enforced in a single server-side accessor** that every read path goes through. No component may query the raw column directly; that accessor is the only place the claim check lives.
- **Strip EXIF from every upload.** A geotagged photo of a damaged home defeats the entire location-privacy design.
- Cache the public list (30-60s ISR). Reads dwarf writes ~100:1.
- Budget: hosting ~$0-20/mo, DB ~$0-25/mo, LLM a few dollars. **SMS is the only real variable cost** — model ~$0.03-0.08 per OTP, cap sends per number per day.
- **Decided 2026-08-31: Replit is the platform.** Repo lives at `C:\Users\melek\OneDrive\Desktop\AlgeriaRelief-live`.

## 10. Core Data Models (core platform)

```
wilaya          id, code, name_ar, name_fr
commune         id, wilaya_id, code, name_ar, name_fr, lat, lng
category        id, code, name_ar, name_fr, icon

person          id, phone_e164 (unique, encrypted at rest), phone_verified_at,
                trust_score, completions_count, upheld_flags_count,
                is_suspended, device_fingerprint, created_at, last_seen_at

request         id, person_id, category_id, commune_id, body, body_lang,
                urgency (normal|high|critical), beneficiary (self|family|neighbour),
                vulnerability_flags[], photo_url,
                delivery_point (home|landmark), address_encrypted, landmark_hint,
                claimed_by_person_id, claimed_at, claim_expires_at, confirm_code,
                status (open|claimed|delivered|expired|removed|quarantined),
                screening_score, screening_reason, dedupe_fingerprint,
                created_at, expires_at, renewed_count, closed_at

trip            id, donor_person_id, request_ids[],
                status (claimed|delivered|expired|cancelled),
                claimed_at, expires_at, completed_at

contact_reveal  id, person_id, request_id, revealed_at, ip, user_agent
flag            id, target_type, target_id, reporter_person_id, reason,
                reporter_trust_weight, created_at
review          id, flag_target_type, target_id, reviewer_person_id, decision, created_at
trust_event     id, person_id, type, delta, source_id, created_at
audit_log       id, actor, action, target_type, target_id, metadata, created_at
crisis_event    id, name, type, active, started_at
```

## 11. UX/UI Guidance

**Mobile-first, stress-first**
- Single column, primary actions thumb-reachable at the bottom. Min 48x48px targets.
- **Two doors on the homepage and nothing else:** "I need help" / "I can help." No hero copy, no carousel, no mission statement above the fold.
- Icon + text for every category — never icon alone (culturally ambiguous), never text alone (slow under stress).
- **Progressive disclosure** — ask the minimum; optional fields collapse behind "Add more detail."
- **Never lose input.** Persist form state to `localStorage` on every field change; a dropped connection mid-submit is normal here, not an edge case.
- Explicit plain-language state at all times ("Sent", "Expires in 71 hours", "3 people can see this"). Silence reads as failure.
- Confirmation before destructive actions; **one tap** for constructive ones.

**Stress and cognitive load**
- Short sentences, concrete verbs, no jargon, low reading level in both languages.
- One decision per screen. A newly evacuated user will not parse an 11-field form.
- Errors say what to do next, not just what went wrong.
- Colour is never the only signal — urgency also carries a text label (accessibility + sunlight legibility).

**Low bandwidth**
- Budget **<100KB first meaningful paint.** No render-blocking web fonts; self-host and subset. No client-side maps. Images lazy, WebP, ~120KB cap.
- Server-render the list — readable before any JS executes.
- Skeletons not spinners; optimistic submit with a clear retry path.

**Accessibility**
- WCAG 2.1 AA contrast; test at high brightness outdoors.
- Full keyboard reach, visible focus rings, semantic landmarks, correct heading order.
- Real `<label>` on every control; errors via `aria-describedby`; live regions for state changes.
- Respect `prefers-reduced-motion`. Text scaling to 200% without layout collapse (critical for older users).
- Screen reader testing in **both** locales — Arabic SR behaviour differs enough to need its own pass.

## 12. Operations and Moderation

**Onboarding at crisis speed**
- Browse with no login; post with one OTP. No email, no password, no profile.
- **Distribution is the launch plan** — the app does not self-seed. Push the link into existing Facebook/WhatsApp groups in affected wilayas; the per-listing share string is the growth loop.
- One-screen "How this works" + permanent safety card, AR/FR.

**Moderation without moderators**
1. Submit -> blocklist -> LLM classifier -> publish / shadow-rank / block
2. Live -> trust-weighted flags -> threshold -> **auto-quarantine**
3. Quarantine -> trusted-user review -> 3 concordant reviews -> auto-resolve
4. No review -> stays hidden -> expires at 72h (**fails closed**)
5. Circuit breakers -> auto-throttle wilaya to read-only + alert operator
6. Operator: abuse inbox, kill switch, per-wilaya throttle. Realistic load: minutes per week.

**Operator runbook (one page)**
- Daily: dashboard counters + abuse inbox.
- Weekly: sample 10 listings; check honeypot hits; review block/flag rates.
- Incident: kill switch -> assess -> throttle wilaya -> restore.

## 13. Privacy, Security, and Risk Management

**Data minimization is the primary control.**
- Collect: phone, commune, category, free text, optional photo, and — **only because delivery is direct** — either a street address or a chosen landmark. **Never:** national ID, date of birth, GPS coordinates, email.
- **Address handling (changed by the direct-delivery decision):** encrypted at rest, never in any public view, never in a list or search result, revealed only to one phone-verified donor who has an active claim, and purged with the request. Receivers who prefer not to give an address choose a landmark meeting point instead — offer this prominently, not as a buried option.
- Phone numbers encrypted at rest, never in any public view, revealed only via the gated logged path.
- EXIF stripped from every image, without exception.
- Commune-level granularity in public views only. Precise location exchanged person-to-person, off-platform, after both sides verified.
- Retention: purge request/offer bodies and photos 30 days after closure; keep anonymized aggregates only. Short retention is also the best answer to future data-protection questions.
- Hardening: HTTPS only, HSTS, strict CSP, rate limits on every mutating endpoint, RLS on all tables, signed short-lived media URLs, no secrets in the client bundle.
- Plain-language privacy notice AR/FR; self-service deletion via phone OTP.
- **Legal:** Algeria's Law 18-07 on personal data protection is likely relevant. Not legal advice — get local counsel before scaling past a pilot. Minimization + 30-day retention is the interim posture, not a substitute.

**Misuse scenarios and mitigations**

| Risk | Mitigation |
|---|---|
| Charity fraud / fake need soliciting money | No payment rail; payment patterns blocked at submit; "never send money" gate |
| Harvesting vulnerable people's phone numbers | Gated reveal, daily quotas, honeypots, auto-suspend |
| Fake offers used to lure or locate people | Verification tier, safety rules at reveal, no public precise location |
| Duplicate/spam flooding | 1 open request per number, dedupe fingerprinting, rate limits |
| Coordinated brigading to suppress real requests | Trust-weighted flags; new accounts near-zero weight |
| Misinformation about fires or shelters | Out of scope by design — categories cover needs, not news; no broadcast |
| Board goes stale, loses credibility | 72h auto-expiry + renewal + closure mechanic |
| Political/ethnic targeting of a region | Per-wilaya throttle; circuit breakers; no demographic fields collected |
| SMS cost spiral or delivery failure | Per-number send caps; unverified-tier fallback |
| Platform blamed for a bad outcome | Non-verification disclaimer, emergency deflection, audit log, reachable abuse contact |

**Failure points to plan for:** SMS deliverability; a traffic spike from one viral Facebook post; the operator unreachable for 48h (hence every default fails closed); an empty trusted-reviewer pool in week one — during which the classifier alone gates publication, so set its threshold conservatively for 7 days then relax.

---

# PART B — Direct donor-to-receiver delivery (revised)

**Decision (2026-08-31):** the hub-and-transporter model is CUT. Donors deliver directly to a named receiver. The donor IS the transporter. One hop, no collection points, no separate driver role, no manifests, no multi-hop custody chain. Rationale: speed to launch, and less time wasted per delivery.

**Model:** donor claims a specific request -> address revealed -> donor drives it there -> both confirm.

Wasted time in a direct model comes from exactly three places. B1-B3 target those and nothing else.

## B1. The claim lock (core anti-waste mechanic)

- Donor taps "I'll deliver this" -> request **locks to them for 6 hours** and disappears from everyone else's list, shown as `reserved`.
- Address + phone revealed at that moment, never before.
- Countdown visible to **both** sides, so the family knows someone is coming and when.
- Lapsed window -> **auto-returns to the pool**, receiver notified. Nothing is silently stranded.
- **One open trip per donor at a time.** This is what stops five donors driving to the same family while four other families get nobody.

Without this lock a direct board wastes MORE time than WhatsApp, because everyone sees the same top request.

## B2. Batch nearby — one trip, several families

- Immediately after claiming: "3 more needs within 2km — add to this trip?"
- Same or adjacent commune only. No routing engine, just a distance filter.
- The batch counts as ONE trip against the one-open-trip cap.
- Highest-leverage feature for donor time; roughly half a day of work.

## B3. Never drive to a need already met

- 72-hour auto-expiry; one-tap close by the receiver.
- Automatic "Still needed?" SMS at 24h. No answer by 48h -> auto-hidden.
- This is what keeps the board from becoming the graveyard that kills these platforms.

## B4. Delivery confirmation — keep it, keep it small

- Receiver reads a **4-digit code** to the donor at the door; donor enters it. One screen.
- Keep the code rather than a one-tap "received": it proves someone was physically present, which is what makes the public delivery count credible to the next donor.
- Acceptable downgrade if a day must be cut: one-tap confirm from the receiver's SMS link. **Do not drop confirmation entirely** — it is also how the board cleans itself.

## B5. New risk: address exposure

Direct delivery means handing a stranger a vulnerable person's home address. That is the price of cutting the middle. Three cheap guards:

- **Reveal only after** the donor is phone-verified AND has claimed. Logged and rate-limited.
- **Receiver chooses at post time:** `deliver to my home` or `meet me at [landmark]`. Many will choose the landmark; let them.
- **Mutual identification** — receiver also sees the donor's name and number. Both sides knowing each other is itself the deterrent.
- **Anti-harvesting:** a donor who repeatedly claims and never confirms is throttled, then suspended. Serial claiming to scrape addresses is the one new attack this model opens; the claim cap plus no-show tracking closes it.

## B6. What this cuts, what it keeps

**Cut:** collection points, transporter/driver role, runs + manifests, multi-hop chain of custody, allocation engine, seat-sharing.

**Kept:** no money on the platform, phone OTP, submit screening, 72h expiry, trust-weighted flags, auto-quarantine, per-household cap, and the per-commune "Needed now / Saturated" board (still useful — it tells donors what to actually bring).

## B7. Data model delta

```
request  + delivery_point (home | landmark), landmark_hint
         + claimed_by_person_id, claimed_at, claim_expires_at
         + confirm_code

trip     id, donor_person_id, request_ids[],
         status(claimed|delivered|expired|cancelled),
         claimed_at, expires_at, completed_at

// removed: collection_point, run, consignment, handoff, allocation
```

## B8. Known gap (do not build for it yet)

Direct-only does not serve a donor without a car, or a remote commune with no donor nearby. Do not pre-build for this. See whether it actually appears in the pilot. If it does, the drop-off / driver layer returns in phase 2 as an **addition**, not a rewrite.

---

## 14. Delivery Roadmap

**Phase 0 — Discovery (Days 1-2, parallel with build)**
- Validate SMS deliverability to +213 across three vendors — **gates the architecture, do it first**
- Source and seed wilaya/commune dataset (58 wilayas, ~1,500 communes)
- Confirm current official emergency numbers from an authoritative source
- Write all AR/FR strings with a native Algerian Arabic speaker — do not machine-translate the UI
- Identify 3-5 Facebook/WhatsApp groups in affected wilayas for distribution

**Phase 1 — MVP build (Days 3-10)**
- Days 3-4: schema, auth/OTP, i18n + RTL skeleton, wilaya/commune seed
- Days 5-6: post request (with delivery_point choice), browse + filters + distance-first ranking
- Days 7-8: **claim lock + address reveal + batch-nearby + 4-digit confirmation + auto-return on lapse**; screening pipeline, dedupe, flags + auto-quarantine, expiry job, "Still needed?" SMS
- Days 9-10: operator dashboard, circuit breakers, public delivery count, "Needed now" board, safety copy, accessibility + RTL pass, load test

**Phase 2 — Pilot (Days 11-17)**
- **One wilaya only.** Seed with real requests gathered from existing FB/WhatsApp groups.
- Watch: claim-to-delivery conversion, claim-lapse rate, time from post to delivery, duplicate-trip incidents, flag rate, false-block rate, SMS cost per posted request.
- Tune the claim window (6h may be wrong — measure it) and rate limits daily against live data.

**Phase 3 — Scale (Weeks 3-6)**
- Expand wilaya by wilaya as trusted-reviewer density builds.
- Add SMS alerts for new nearby requests, saved searches, commune heat density.
- Reassess the no-car / remote-commune gap; add drop-off points or a driver role ONLY if the pilot proves it necessary.
- Pursue a real operating partner and legal review; publish a public stats page.

**Prioritization principle:** anything that prevents harm ships in MVP; anything that improves efficiency waits — except the claim lock, which is both.

---

## 15. Recommended MVP

Minimum to launch quickly **and** responsibly with no moderation staff:

1. Browse without login — public, server-rendered, **distance-first** ranked, filterable by wilaya/commune/category
2. Post a request — 5 fields, phone OTP only, no account, under 60 seconds
3. **Delivery point choice on every request** — deliver to my home, or meet at a landmark
4. Wilaya + commune taxonomy — seeded, searchable, bilingual, code-based
5. Phone OTP verification — identity spine, with unverified fallback tier if SMS fails
6. **Claim lock** — "I'll deliver this" reserves the request for 6h, hides it from others, shows a countdown to both sides, auto-returns to the pool on lapse
7. **One open trip per donor**, with no-show throttling and suspension
8. **Batch nearby** — add other requests within ~2km to the same trip, counted as one trip
9. **Gated address + contact reveal** — only after phone verification and claim; logged and rate-limited; mutual (receiver sees donor too)
10. **4-digit delivery confirmation** read by the receiver at the door
11. 72-hour auto-expiry + one-tap close + automatic "Still needed?" SMS at 24h
12. Automated screening at submit — payment-detail blocker + LLM scam/abuse classifier (AR/FR/Darija)
13. Duplicate detection with merge prompt
14. Trust-weighted flagging -> auto-quarantine, failing closed
15. Community review queue unlocked by earned trust — three concordant reviews auto-resolve
16. Rate limits and circuit breakers — per phone/device/IP; auto-throttle a wilaya on abuse spikes
17. Emergency deflection — life-threatening interstitial before the request form + persistent banner
18. Per-commune "Needed now / Saturated" board so donors bring the right thing
19. Public delivery count (confirmed deliveries per wilaya) as the trust signal
20. Full AR/FR with true RTL — logical properties, bidi isolation, Western numerals, Arabic type stack
21. Operator dashboard — quarantine, counters, per-wilaya throttle, global kill switch
22. Privacy by minimization — no national IDs, EXIF stripped, 30-day retention, self-service deletion
23. Abuse-report email + takedown path — the one irreducible human touchpoint

**Cut or deferred:** collection points, transporter/driver role, runs and manifests, multi-hop custody, allocation engine, seat-sharing, standing offers, saved searches, heat density, public map, chat, push notifications, password accounts, organization accounts, any form of payment.
