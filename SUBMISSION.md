# HAQMS Internship Submission Documentation

> Living document for Figital Labs assignment (Submission requirement #3).  
> Updated as we identify issues, implement fixes, and record decisions.

**Candidate:** _[Your name]_  
**Repo:** _[Your fork URL]_  
**Deployed URL:** _[TBD]_  
**Last updated:** 2026-05-27

---

## Table of contents

1. [Approach & prioritization](#approach--prioritization)
2. [Work log (issues → fixes → optimizations)](#work-log)
3. [Remaining known issues](#remaining-known-issues)
4. [Major decisions (reasoning)](#major-decisions-reasoning)

---

## Approach & prioritization

### Overall strategy

_[Your words — fill in after we discuss]_

**Draft (confirm or edit):**

- Start with **local setup** so the app runs end-to-end before auditing bugs.
- Fix **blockers** first (auth/login, DB seed, env) so seeded demo accounts work for manual testing.
- Then tackle README challenges by area: security → backend perf → DB → frontend → incomplete features.
- Document each change as we go rather than at the end.

### Why setup before security/perf fixes?

_[Your reasoning]_

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

> _[Why enforce this in DB instead of only API logic?]_

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

> _[Which queries were you optimizing for first, and why?]_

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

> _[Why keep API response shape unchanged while optimizing internals?]_

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
- `GET /api/appointments` returned `count=1`\n
- `GET /api/doctors/stats` returned `success=true`\n
- `GET /api/reports/doctor-stats` returned `data.length=1`\n
- `POST /api/queue/checkin` returned `tokenNumber=1`\n

---

## Remaining known issues

_From README evaluation tasks — not yet addressed unless noted._

### Security (Challenge 1)

- [ ] Plain-text password logging in auth routes
- [ ] JWT stored in localStorage; weak/hardcoded secret; `ignoreExpiration: true` in middleware
- [ ] SQL injection in search endpoint
- [ ] Admin authorization bypass (`authorizeAdminOnlyLegacy`)

### Backend performance & concurrency (Challenge 2)

- [x] N+1 queries on list endpoints (appointments list)
- [x] Sequential async where parallel is possible (doctors stats)
- [x] Slow nested reports endpoint (doctor-stats report)
- [x] Queue check-in token race condition (token assignment serialization)

### Database (Challenge 3)

- [x] Missing constraints (double-booking same slot)
- [x] Missing indices on FKs / status filters
- [x] In-memory pagination instead of SQL `LIMIT`/`OFFSET`

### Frontend (Challenge 4)

- [ ] Memory leak on `/queue` (mount/unmount)
- [ ] Search inputs causing full list re-renders
- [ ] Doctor patient view crash on null medical history

### Incomplete features (Challenge 5)

- [ ] Missing page: `src/app/patients/[id]/history-records/page.js`

### Setup / repo (our notes)

- [ ] Align `DATABASE_URL` port with Docker vs local Postgres
- [ ] Remove accidentally committed `frontend/.next/` from git tracking
- [ ] Full Prisma schema likely still missing Patient, Doctor, Appointment, Queue models (seed may only cover User for now)

---

## Major decisions (reasoning)

| Decision | Options considered | Choice made | Reasoning (your voice) |
|----------|-------------------|-------------|------------------------|
| Fix login/seed before security audit | Seed first vs jump to JWT fixes | Seed/schema first | _[TBD]_ |
| `migrate deploy` vs `migrate dev` in scripts | Interactive vs CI-friendly | `migrate deploy` in `db:setup` | _[TBD]_ |
| Next task priority | Security vs perf vs frontend | _[TBD]_ | _[TBD]_ |

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
