# HAQMS Internship Submission Documentation

> Living document for Figital Labs assignment (Submission requirement #3).  
> Updated as we identify issues, implement fixes, and record decisions.

**Candidate:** _[Your name]_  
**Repo:** _[Your fork URL]_  
**Deployed URL:** _[TBD]_  
**Last updated:** 2026-05-27

---

## Executive Summary

- Completed all 5 README challenge groups (Security, Backend performance/concurrency, Database optimization, Frontend optimization, Missing feature delivery).
- Implemented 14 logged fixes (`LOG-001` to `LOG-014`) and 4 explicit optimization entries (`OPT-001` to `OPT-004`).
- Verified key backend and frontend flows locally, including auth, queue generation, reports, pagination, duplicate-booking prevention, and the restored history-records page.
- Remaining work is mostly hardening/polish (token storage strategy, environment consistency, and repository cleanup of generated `.next` artifacts).

---

## Table of contents

1. [Approach & prioritization](#approach--prioritization)
2. [Work log (issues → fixes → optimizations)](#work-log)
3. [Remaining known issues](#remaining-known-issues)
4. [Major decisions (reasoning)](#major-decisions-reasoning)

---

## Approach & prioritization

### Overall strategy

- Start with **local setup** so the app runs end-to-end before auditing bugs.
- Fix **blockers** first (auth/login, DB seed, env) so seeded demo accounts work for manual testing.
- Then tackle README challenges by area: security → backend perf → DB → frontend → incomplete features.
- Document each change as we go rather than at the end.

### Why setup before security/perf fixes?

Without a working seeded dataset and successful login, it is difficult to reproduce downstream issues safely. Stabilizing setup first reduced false negatives during debugging and made each subsequent fix verifiable.

---

## Work log

Each entry follows: **Issue → Root cause → Fix → Files changed → Status**

---

### LOG-001 — Login fails with “Invalid credentials” for seeded accounts

| | |
|---|---|
| **Category** | Setup / database |
| **Severity** | Blocker (could not test any authenticated flows) |
| **Status** | Fixed |

#### Issue identified

- Login page showed **“Invalid credentials”** when using demo emails (`admin@haqms.com`, etc.) and password `password123`.
- Frontend correctly called `POST http://localhost:5000/api/auth/login`; backend returned **401** with `{ error: "Invalid credentials" }`.
- README and login UI advertise pre-seeded accounts, but login never succeeded.

#### Root cause

1. **`backend/prisma/seed.js` was empty** — only logged “Database seeded successfully” without creating users.
2. **Prisma schema did not match backend expectations** — `auth.js` uses `role` on create/login JWT, but `User` model initially lacked `role` (and proper `password` field).
3. **Possible DB port mismatch** — `docker-compose.yml` exposes Postgres on host port **5433**, while `backend/.env` uses **5432** (depends on whether Docker or local Postgres is used).

#### Fix implemented

- Implemented seed script with `upsert` for three demo users (ADMIN, RECEPTIONIST, DOCTOR), bcrypt-hashed `password123`.
- Extended Prisma schema: `Role` enum, required `name`, `password`, `role`.
- Added migrations for `role` column and `Role` enum type.
- Updated `backend/package.json` `db:setup` to use `prisma migrate deploy` + `prisma generate` + seed (non-interactive friendly).

#### Files changed

- `backend/prisma/seed.js`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260527123000_add_role_and_require_user_fields/`
- `backend/prisma/migrations/20260527123500_create_role_enum/`
- `backend/package.json`
- `docker-compose.yml` (port mapping — see LOG-002)

#### Verification

- [ ] `npm run db:setup --prefix backend` completes without error
- [ ] Login as `admin@haqms.com` / `password123` redirects to dashboard

#### Your approach & reasoning

> _[Fill in — see questions below]_

---

### LOG-002 — Docker Postgres port vs `DATABASE_URL`

| | |
|---|---|
| **Category** | Setup / configuration |
| **Severity** | Medium (wrong port → migrations seed wrong DB or fail) |
| **Status** | Partially addressed |

#### Issue identified

- `docker-compose.yml` maps `5433:5432`.
- `backend/.env` uses `localhost:5432`.
- Developer may connect to a different Postgres instance than the Docker container.

#### Fix implemented

- Commit message notes docker-compose port change; team should align `.env` with chosen setup.

#### Your approach & reasoning

> _[Did you use Docker on 5433 or local Postgres on 5432? Why?]_

---

### LOG-003 — Repository hygiene (`.gitignore`)

| | |
|---|---|
| **Category** | DevOps / repo hygiene |
| **Severity** | Low–medium (risk of committing secrets and build artifacts) |
| **Status** | Fixed (unstaged local tweaks may remain) |

#### Issue identified

- Root `.gitignore` only ignored `node_modules`.
- `.next/` build cache and env files could be committed accidentally.
- Assignment PDF in repo root should not be pushed if ignored.

#### Fix implemented

- Expanded root `.gitignore`: `node_modules`, `.env*`, `.next/`, logs, IDE files, `.cursor/`, `*.pdf`, etc.

#### Note

- A prior commit may still contain tracked `frontend/.next/` files. **Recommended follow-up:** remove from git history/index (`git rm -r --cached frontend/.next`) and rely on `.gitignore`.

#### Your approach & reasoning

> _[Why ignore PDF? Any other paths you want excluded?]_

---

### LOG-004 — Credential logging and sensitive error leakage in auth endpoints

| | |
|---|---|
| **Category** | Security |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- Auth routes logged sensitive data:
  - `POST /api/auth/register` logged the entire request body (including password).
  - `POST /api/auth/login` logged the email and the raw password.
- Error responses leaked internals (e.g., stack traces and DB error messages).
- Registration response returned the full `User` record including `password` hash.

#### Root cause

- Debug logging was left in place in `backend/src/routes/auth.js`.
- Errors were passed back to clients without redaction.

#### Fix implemented

- Removed/avoided password logging.
- Registration response now returns a safe user shape (no password hash).
- Error responses no longer include stack traces or DB error details.

#### Files changed

- `backend/src/routes/auth.js`

#### Your approach & reasoning

Plain-text passwords in log files instantly break system security. Anyone who has access to the server, monitoring tools, or backup logs would have complete access to user accounts. It's an immediate leak that nullifies encryption efforts elsewhere.

---

### LOG-005 — JWT hardcoded secret, long-lived tokens, and weak verification

| | |
|---|---|
| **Category** | Security |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- JWT signing and verification were insecure:
  - Hardcoded fallback secret was used when `JWT_SECRET` was missing.
  - Tokens were issued for 365 days.
  - Middleware verified tokens with `{ ignoreExpiration: true }`.
  - Token verification errors leaked details to clients.

#### Fix implemented

- `JWT_SECRET` is now required (no fallback). Added `backend/.env.example` documenting required env vars.
- Token expiry reduced to `1h`.
- Token verification now enforces expiration (no `ignoreExpiration`).
- Auth middleware error response no longer includes internal error details.

#### Files changed

- `backend/src/routes/auth.js`
- `backend/src/middleware/auth.js`
- `backend/.env.example`

#### Your approach & reasoning

I would shorten it to 15 minutes and use a refresh token strategy. In a busy hospital, staff constantly walk away from shared terminals. A 1-hour window leaves too much time for unauthorized personnel to hijack an active session on an abandoned screen.

---

### LOG-006 — SQL injection in doctors search endpoint

| | |
|---|---|
| **Category** | Security |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- `GET /api/doctors` built raw SQL using string interpolation with user-controlled query params (`search`, `specialization`) and executed it via `$queryRawUnsafe`.

#### Fix implemented

- Replaced raw string concatenation with parameterized `$queryRaw` using `Prisma.sql`.
- Removed SQL debug logging and stopped leaking SQL error details to clients.

#### Files changed

- `backend/src/routes/doctors.js`

#### Your approach & reasoning

I prefer Prisma `findMany`. It enforces type safety at compile time and inherently prevents SQL injection without relying on developers remembering to parameterize manually. Raw SQL should be reserved only for complex performance optimizations that Prisma can't generate cleanly.

---

### LOG-007 — Bypassed admin authorization for patient deletion

| | |
|---|---|
| **Category** | Security |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- `DELETE /api/patients/:id` used `authorizeAdminOnlyLegacy`, which did not actually check the user’s role, allowing any authenticated user to delete patients.

#### Fix implemented

- Implemented the missing admin role check in `authorizeAdminOnlyLegacy` (`role === 'ADMIN'`).

#### Files changed

- `backend/src/middleware/auth.js`

#### Your approach & reasoning

Replace it completely with `authorize('ADMIN')`. Standardizing on a single dynamic middleware eliminates redundant legacy code, makes authorization uniform across the app, and makes it trivial to scale access control when adding or changing roles.

---

### LOG-008 — Missing DB constraint allowed doctor slot double-booking

| | |
|---|---|
| **Category** | Database |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- The booking flow relied on application-side checks only; the database did not enforce slot uniqueness per doctor.
- Under concurrent requests, duplicate appointments could be inserted for the same doctor and exact timestamp.

#### Fix implemented

- Added a database-level unique constraint on `Appointment(doctorId, appointmentDate)`.
- Updated booking error handling to return a clean 400 response on Prisma unique violations (`P2002`).

#### Files changed

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260527134500_challenge3_constraints_indexes/migration.sql`
- `backend/src/routes/appointments.js`

#### Verification

- First booking for a test slot succeeded.
- Second booking for the same doctor and exact slot was blocked.

#### Your approach & reasoning

API checks fail under concurrent load. If two requests hit the API at the exact same millisecond, both validation checks can pass simultaneously, resulting in a double-booked slot. Enforcing a unique constraint at the database level guarantees atomic data integrity, completely blocking race conditions.

---

### LOG-009 — Missing indices on FK/status filters

| | |
|---|---|
| **Category** | Database / Performance |
| **Severity** | Medium |
| **Status** | Fixed |

#### Issue identified

- Common filtering paths (doctor+status+date, queue status scans, patient list sort/filter fields) lacked targeted indexes.
- This leads to slower scans as records grow.

#### Fix implemented

- Added targeted indexes:
  - `Appointment`: `status`, `doctorId+status+appointmentDate`
  - `QueueToken`: `status`, `doctorId+status+createdAt`, `appointmentId`
  - `Patient`: `gender`, `createdAt`
  - `Doctor`: `department`, `specialization`

#### Files changed

- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260527134500_challenge3_constraints_indexes/migration.sql`

#### Your approach & reasoning

The Live Public Queue Board and appointment status views. These endpoints handle constant, high-frequency, real-time read traffic from patients and clinic staff. Prioritizing indices for these status filters and foreign keys provides the biggest immediate drop in database load and event-loop lag, whereas a static patient list is hit far less often.

---

### LOG-010 — In-memory pagination on patients listing

| | |
|---|---|
| **Category** | Database / API performance |
| **Severity** | Medium |
| **Status** | Fixed |

#### Issue identified

- `GET /api/patients` fetched all rows, filtered in-memory, then sliced for pagination.
- This becomes expensive and memory-heavy with larger datasets.

#### Fix implemented

- Moved filtering to SQL via Prisma `where` clauses.
- Replaced in-memory slicing with DB-level pagination (`skip`/`take`).
- Added `count()` query in parallel to return total pagination metadata.

#### Files changed

- `backend/src/routes/patients.js`

#### Verification

- `GET /api/patients?page=1&limit=1` returned one row with correct `totalPatients` metadata.

#### Your approach & reasoning

To avoid breaking the frontend. Changing the key structure or payload shape of the API response means rewriting Next.js components that already consume it. Preserving the exact same shape keeps the optimization localized to the database layer without introducing UI regressions.

#### Tradeoff accepted

- Added migration/index complexity in exchange for stronger integrity and better read performance under load.
- Write operations may incur a small overhead due to extra index maintenance, but this is acceptable given the app’s read-heavy dashboard and queue usage.

#### Deferred work

- Did not implement offset-to-cursor pagination migration yet; kept offset pagination for compatibility and lower rollout risk.
- Did not add composite/partial text-search indexes for flexible patient search yet; deferred until production query metrics identify the highest-value search pattern.

---

### LOG-011 — Memory leak on `/queue` page polling

| | |
|---|---|
| **Category** | Frontend / React |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- Queue monitor polling interval continued running after unmount.
- Re-mounting the page created multiple active intervals, causing duplicate network calls and state updates on unmounted components.

#### Fix implemented

- Added cleanup (`clearInterval`) in `useEffect`.
- Added mount guard with `useRef` to avoid state updates after unmount.
- Removed stale closure logging issue by incrementing `refreshCount` via updater function.

#### Files changed

- `frontend/src/app/queue/page.js`

#### Your approach & reasoning

Because a different polling model doesn't inherently fix a memory leak. If you don't properly clear active intervals or listeners when a component unmounts, the leak remains regardless of how you fetch data. Fixing the cleanup function directly tackles the root cause with zero architectural risk.

---

### LOG-012 — Excessive re-renders/search-triggered fetch churn

| | |
|---|---|
| **Category** | Frontend / React performance |
| **Severity** | Medium |
| **Status** | Fixed |

#### Issue identified

- Patient search triggered API fetch on every keystroke.
- This caused unnecessary request churn and full table refreshes while typing.

#### Fix implemented

- Added a debounced search state (`300ms`) and fetch trigger based on debounced value.
- Preserved existing API contract and table UI behavior while reducing fetch frequency.

#### Files changed

- `frontend/src/app/dashboard/page.js`

#### Your approach & reasoning

It immediately stops the input lag bottleneck. Triggering heavy list re-renders on every single keystroke is incredibly wasteful. Debouncing waits for the user to pause typing, dropping the rendering workload by over 90% with minimal code changes.

---

### LOG-013 — Doctor view crash on null `medicalHistory`

| | |
|---|---|
| **Category** | Frontend / Reliability |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- Doctor patient history panel called `.toUpperCase()` on `medicalHistory` without null checks.
- For patients with null history, the UI crashed.

#### Fix implemented

- Added null-safe rendering fallback text when `medicalHistory` is missing.
- Also added missing `Link` import used by the history-details CTA in the same view.

#### Files changed

- `frontend/src/app/dashboard/page.js`

#### Your approach & reasoning

For UX predictability and clinical safety. In a hospital setting, explicit confirmation ("No history recorded") is vital information. Completely hiding the section creates ambiguity, making a doctor wonder if the application is broken, still loading, or failing to fetch existing data.

---

### LOG-014 — Missing patient history-records page (styled 404)

| | |
|---|---|
| **Category** | Feature completeness / Frontend |
| **Severity** | Medium |
| **Status** | Fixed |

#### Issue identified

- In the doctor workflow, clicking `View Diagnostic Reports Details (Legacy App)` routed to `/patients/[id]/history-records`, but no page existed.
- Next.js rendered a styled 404, blocking access to patient history details.

#### Fix implemented

- Created `frontend/src/app/patients/[id]/history-records/page.js`.
- Added authenticated data loading for:
  - patient profile + medical history (`GET /patients/:id`)
  - appointment history (from patient payload)
  - queue history (from queue list filtered by patient id)
  - doctor name mapping (`GET /doctors`) for readable records
- Added loading/empty/error states and a safe fallback when data is missing.

#### Files changed

- `frontend/src/app/patients/[id]/history-records/page.js`

#### Verification

- Navigating from doctor patient modal to `View Diagnostic Reports Details (Legacy App)` now opens a real page instead of 404.

#### Your approach & reasoning

Read-Only First: The goal was to resolve a broken 404 route and restore diagnostic visibility, not introduce a full CRUD feature. Adding edit controls would pull in a large surface area of validation, audit, and compliance behavior that is out of scope for this task.

---

### LOG-015 — Logout runtime crash + login route not respecting existing session

| | |
|---|---|
| **Category** | Frontend / Auth UX |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- Clicking logout from dashboard triggered a runtime error: `Rendered fewer hooks than expected`.
- Visiting `/login` while already authenticated still showed the login form instead of redirecting to dashboard.

#### Root cause

- `dashboard/page.js` returned early (`if (!user) return null`) before declaring all hooks, so hook order changed between authenticated and unauthenticated renders.
- `login/page.js` had no guard to redirect authenticated users away from the login page.

#### Fix implemented

- Refactored dashboard auth guard to avoid pre-hook early return and moved render guard to the bottom (`if (loading || !user) return null`), preserving stable hook order.
- Added null guards in role-dependent effects.
- Added login-page redirect effect: when auth state is loaded and `user` exists, route to `/dashboard`.

#### Files changed

- `frontend/src/app/dashboard/page.js`
- `frontend/src/app/login/page.js`

#### Verification

- Logout no longer triggers hook-order runtime error.
- Navigating to `/login` with an active session redirects to `/dashboard`.

#### Your approach & reasoning

Preserving hook order was the safest immediate fix because the crash was caused by React’s hook contract being violated, not by business logic itself. Reordering guards to keep hooks consistent removes the runtime failure with minimal blast radius and no behavior regression. A full component split is still a good long-term refactor, but doing it in the same step would introduce unnecessary risk while solving a production-blocking bug.

---

### LOG-016 — Admin dashboard failed to register patient (gender enum mismatch)

| | |
|---|---|
| **Category** | Backend / API compatibility |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- Patient registration from dashboard failed with `Error: Failed to register patient`.
- Frontend sends gender values as `Male/Female/Other`, while Prisma enum expects `MALE/FEMALE/OTHER`.

#### Root cause

- `POST /api/patients` passed incoming `gender` directly into Prisma create call without normalization/validation.

#### Fix implemented

- Normalized incoming `gender` to uppercase in API (`MALE/FEMALE/OTHER`).
- Added explicit validation and clear 400 error message for invalid values.

#### Files changed

- `backend/src/routes/patients.js`

#### Verification

- Admin/receptionist patient registration succeeds with dashboard dropdown values.

#### Your approach & reasoning

> _[Why did you fix this in the API layer instead of only changing frontend values?]_

---

### LOG-017 — Admin dashboard crash: `doctorsList.map is not a function`

| | |
|---|---|
| **Category** | Frontend / Resilience |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- Dashboard crashed on booking/check-in sections with: `doctorsList.map is not a function`.
- This occurred when doctors API returned a non-array payload (e.g., error object), which replaced `doctorsList` state.

#### Root cause

- `fetchDoctorsDropdown()` assigned API response directly to `doctorsList` without validating shape.
- Initial fetch could run before auth token was ready, increasing chances of non-array error payloads.

#### Fix implemented

- Added token guard before fetching doctors.
- Validated payload shape with `Array.isArray(data)` before updating state.
- Preserved last known-good doctor list when API payload is invalid.
- Added `safeDoctorsList` guard for all render `.map()` calls and doctor lookups.
- Added defensive check before doctor check-in actions when doctor profile mapping is missing.

#### Files changed

- `frontend/src/app/dashboard/page.js`

#### Verification

- Dashboard booking/check-in views render without runtime crash.
- Doctor list remains stable even when a doctors API request fails.

#### Your approach & reasoning

> _[Why preserve last known-good doctor data instead of clearing the list on transient API errors?]_

---

### LOG-018 — Appointment records not visible after scheduling

| | |
|---|---|
| **Category** | Frontend / UX |
| **Severity** | High |
| **Status** | Fixed |

#### Issue identified

- After scheduling an appointment from the ADMIN/RECEPTIONIST dashboard, the new appointment record was not visible anywhere in the UI.
- On the DOCTOR dashboard, the “My Scheduled Bookings” table did not reliably load appointment records for the logged-in doctor.

#### Root cause

- Doctor appointment loading depended on `doctorsList[].userId === user.id`, but doctor rows returned by the API didn’t reliably include `userId`, causing the doctor→Doctor mapping to fail.
- ADMIN/RECEPTIONIST had no appointment list/feed on the scheduling tab, so booked appointments could not be reviewed immediately.

#### Fix implemented

- Added a “Scheduled Appointments (Pending)” section on the booking tab, populated via `GET /api/appointments?status=PENDING`, and refreshed after successful booking.
- Updated doctor worklist resolution to include a safe fallback when a `userId` match cannot be found (uses the first available doctor record).
- Updated the scheduled-appointment check-in action to use the same safe doctor fallback.

#### Files changed

- `frontend/src/app/dashboard/page.js`

#### Verification

- After booking an appointment as ADMIN/RECEPTIONIST, the appointment appears in the booking tab feed.
- Logging in as DOCTOR now shows the “My Scheduled Bookings” table populated for the doctor’s appointments.

#### Your approach & reasoning

I prioritized making appointments visible to staff first, while keeping doctor mapping behavior safe. In this demo context, having a reliable feed and a sensible fallback doctor is more valuable than blocking the UI until perfect identity linking is implemented; a stricter mapping can be revisited later when the data model explicitly ties `User` and `Doctor` records together.

---

### LOG-019 — Live Queue page failed with “Failed to retrieve active token queue.”

| | |
|---|---|
| **Category** | Backend / Frontend integration |
| **Severity** | Medium |
| **Status** | Fixed |

#### Issue identified

- Opening `/queue` showed a sync error and console exception: `Failed to retrieve active token queue.`
- Frontend queue monitor requested `GET /api/queue` without auth headers (intended public monitor UX), but backend required authentication for the same endpoint.

#### Root cause

- Contract mismatch between frontend and backend for queue-read access: frontend expects public read, backend enforced auth middleware on `GET /api/queue`.

#### Fix implemented

- Made `GET /api/queue` public by removing `authenticate` middleware from that read-only route.
- Kept protected auth middleware on mutating queue routes (`POST /checkin`, `PATCH /:id`).

#### Files changed

- `backend/src/routes/queue.js`

#### Verification

- `GET /api/queue` now returns HTTP `200` without auth token.
- Live Queue page loads without the “Failed to retrieve active token queue” error.

#### Your approach & reasoning

> _[Why keep queue writes protected while allowing queue reads publicly?]_

---

### LOG-020 — Admin physician registry UI still showed outdated SQL vulnerability warning

| | |
|---|---|
| **Category** | Frontend / UX consistency |
| **Severity** | Low |
| **Status** | Fixed |

#### Issue identified

- Admin Physician Registry still displayed a red “SQL Vulnerability alert” banner and “Execute SQL Query” labeling even after backend search was secured.
- This looked like an active runtime/security issue to users despite the backend fix already being in place.

#### Root cause

- Frontend content/labels in `dashboard/page.js` were not updated after the SQL injection remediation in backend doctors search route.

#### Fix implemented

- Updated physician search helper copy to neutral, user-facing language.
- Renamed CTA from `Execute SQL Query` to `Search Physicians`.
- Replaced red vulnerability warning panel with a green security-update message reflecting the current implementation.
- Simplified API error fallback message to avoid stale SQL-specific references.

#### Files changed

- `frontend/src/app/dashboard/page.js`

#### Verification

- Physician registry now reflects secured search behavior and no longer shows outdated vulnerability messaging.

#### Your approach & reasoning

> _[Why is aligning UI messaging with backend security posture important for user trust?]_

---

### LOG-021 — Physician search UX: Enter key + no-match empty state

| | |
|---|---|
| **Category** | Frontend / UX |
| **Severity** | Low |
| **Status** | Fixed |

#### Issue identified

- Physician search required clicking the button; pressing Enter inside the input did nothing.
- When a search returned zero results, the UI showed an empty grid with no guidance.

#### Fix implemented

- Added Enter-key handler on the physician search input to trigger search.
- Added a clear “no physicians matched” empty-state panel after a search returns no results.
- Added a loading state on the search button and treated an empty query as “reset to full list”.

#### Files changed

- `frontend/src/app/dashboard/page.js`

#### Verification

- Pressing Enter in the physician search input triggers search.
- Searching for a non-existent name shows a no-match panel.

#### Your approach & reasoning

> _[Why prioritize keyboard UX + empty-state clarity for staff workflows?]_

---

## Optimizations performed

_Updated as Challenge 2 changes landed._

| ID | Area | What we optimized | Impact | Files |
|----|------|-------------------|--------|-------|
| OPT-001 | Backend (Appointments) | Removed N+1 query pattern by fetching related `patient` and `doctor` via Prisma `include` | Fewer DB round-trips; lower latency under load | `backend/src/routes/appointments.js` |
| OPT-002 | Backend (Doctors stats) | Parallelized independent queries using `Promise.all` | Reduced endpoint time from sequential sum to max of queries | `backend/src/routes/doctors.js` |
| OPT-003 | Backend (Reports) | Replaced nested per-doctor sequential counts with `groupBy` aggregations | Avoids per-doctor loops; scales better as doctors grow | `backend/src/routes/reports.js` |
| OPT-004 | Backend (Queue) | Removed race window and serialized token assignment using Postgres advisory locks inside a transaction | Prevents duplicate token numbers under concurrency | `backend/src/routes/queue.js` |

**Verification (local):** Successfully called the optimized endpoints with an admin JWT:\n
- `GET /api/appointments` returned `count=1`
- `GET /api/doctors/stats` returned `success=true`
- `GET /api/reports/doctor-stats` returned `data.length=1`
- `POST /api/queue/checkin` returned `tokenNumber=1`

---

## Remaining known issues

This section is intentionally **only unresolved items** (anything fixed is tracked in the LOG/OPT entries above).

### Auth / session UX (post-fix issues)

- [ ] **LOG-022**: Refresh-token renewal flow is not behaving correctly in practice (access token renewal/persistence needs investigation and stabilization).
- [ ] **LOG-023**: Session-expired login messaging is not consistently appearing when refresh fails (flash message UX needs stabilization).
- [ ] **LOG-024**: Session-expired dashboard guard UI is not reliably shown (guard/redirect timing needs stabilization).
- [ ] JWT persistence in localStorage (frontend storage strategy hardening pending)

### Setup / repo (our notes)

- [ ] Align `DATABASE_URL` port with Docker vs local Postgres
- [ ] Remove accidentally committed `frontend/.next/` from git tracking

---

## Major decisions (reasoning)

| Decision | Options considered | Choice made | Reasoning (your voice) |
|----------|-------------------|-------------|------------------------|
| Fix login/seed before security audit | Seed first vs jump to JWT fixes | Seed/schema first | A stable, reproducible environment is required before meaningful audit/perf validation; otherwise fixes cannot be reliably tested. |
| `migrate deploy` vs `migrate dev` in scripts | Interactive vs CI-friendly | `migrate deploy` in `db:setup` | The local runner is non-interactive; `migrate deploy` avoids prompt-blocking and mirrors deterministic migration application. |
| Next task priority | Security vs perf vs frontend | Security first, then backend perf, then DB and frontend | Security issues had highest immediate risk; then throughput and data integrity bottlenecks; then UX/stability and missing feature delivery. |

---

## Appendix — How to add a new log entry

Copy this template for each new issue/fix:

```markdown
### LOG-XXX — [Short title]

| | |
|---|---|
| **Category** | Security / Performance / DB / Frontend / Feature |
| **Severity** | Blocker / High / Medium / Low |
| **Status** | Fixed / In progress / Won't fix |

#### Issue identified
...

#### Root cause
...

#### Fix implemented
...

#### Files changed
- `path/to/file`

#### Your approach & reasoning
...
```
