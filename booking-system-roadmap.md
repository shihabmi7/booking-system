# Appointment Booking & Check-in System — Project Roadmap

## Decisions locked in
- **Scope:** Single business MVP first (one clinic/salon/dentist), full flow end to end.
- **Architecture:** Monolith — Express + TypeScript on EC2, Postgres on RDS. AWS services layered in incrementally, not serverless-first.
- **Check-in method:** QR code encodes the raw booking ID; staff/kiosk scans or types the ID to check a customer in.

## Data model
As implemented in `backend/prisma/schema.prisma` (Phase 2):
- **Business** — name, timezone, has many Holidays.
- **Resource** — a doctor/stylist/chair (belongs to a Business), working hours, `closedWeekdays` (recurring weekly days off).
- **Service** — name, duration, price (offered by a Resource).
- **Booking** — customer info, start/end time, service, resource, status (BOOKED / CHECKED_IN / COMPLETED / NO_SHOW / CANCELLED), unique `bookingRef` for QR/check-in, `checkedInAt` + `checkInMethod`.
- **Holiday** — a one-off closed date for a Business (public holiday, planned closure), separate from `closedWeekdays`' recurring pattern.
- No separate **Slot** table — availability is computed on demand (Phase 3) from a Resource's working hours minus existing Bookings, not pre-generated/stored.
- No separate **CheckIn** table — it's a 1:1 relationship, so `checkedInAt`/`checkInMethod` live directly on Booking instead.

## Phased plan

### Phase 1 — Project setup ✅ DONE
- Node.js + TypeScript project, Express app skeleton, `/api/health` route.
- React + TypeScript frontend (Vite) wired to call the backend.
- Postgres running locally via Docker, connected end-to-end (verified `dbConnected: true`).
- **Interview angle:** project structure/layering, TS config choices.

### Phase 2 — Core domain & schema ✅ DONE
- Prisma added as ORM + migration tool (replaced raw `pg`).
- `schema.prisma`: Business, Resource, Service, Booking models + BookingStatus enum.
  (No separate Slot or CheckIn table — see schema.prisma comments for why.)
- Seed script for one sample business/resource/services.
- `GET /api/services` — proves schema + migration + seed work end-to-end.
- Health check switched from raw `pg.query` to `prisma.$queryRaw`.
- Frontend: React Router added, `App.tsx` split into a layout shell with `/` (health check)
  and `/services` (renders real seeded data) routes.
- Along the way: fixed a Postgres permission error (`booking_user` needed `CREATEDB` for
  Prisma's shadow database) by granting it directly in the running container.
- **Interview angle:** relational schema design, normalization, ORM vs raw SQL tradeoffs.

### Phase 3 — Booking API ✅ DONE
- `GET /api/slots?resourceId&serviceId&date` — computes open slots from a resource's working
  hours minus existing (non-cancelled) bookings for that day.
- `POST /api/bookings` — validates the requested slot is actually open, creates the booking.
  Double-booking is prevented two ways: an application-level availability check (clear error
  message) plus a `@@unique([resourceId, startTime])` DB constraint as the real backstop
  against race conditions (the app check and the insert aren't atomic).
- Idempotency: optional `idempotencyKey` on the request — a repeated key returns the original
  booking instead of creating a duplicate.
- `GET /api/bookings/:bookingRef` — public lookup by the customer-facing reference, will power
  Phase 4's QR check-in.
- Postman collection (`postman/booking-system.postman_collection.json`) covering all endpoints,
  including dedicated double-booking and idempotency test requests.
- Frontend: `/book` — a service → date → slot → customer-info booking wizard. `/find-booking` —
  manual booking-reference lookup. `/bookings/:bookingRef` — details page, shared by both the
  post-booking redirect and the manual lookup, same URL shape Phase 4's QR check-in will use.
- **Interview angle:** concurrency control, check-then-act races, transactions, idempotency keys.

### Post-Phase 3 addition — Holidays & working-hours settings ✅ DONE
Not originally scoped for a specific phase, added when it came up during Phase 3 testing.
- Schema: `Resource.closedWeekdays` (recurring weekly days off, e.g. every Friday) and a new
  `Holiday` model (one-off closed dates per Business, e.g. a public holiday).
- `services/availability.ts` checks both before generating any slot candidates — a fully
  closed day returns an empty slot list plus a human-readable `note` explaining why.
- `GET /api/slots` response shape changed from a bare array to `{ slots, note }` — frontend
  `BookPage` updated to match and display the note.
- New endpoints (unauthenticated for now — will be gated behind Phase 5's auth):
  `GET/POST /api/holidays`, `DELETE /api/holidays/:id`, `GET /api/resources`,
  `PATCH /api/resources/:id`.
- Seed script updated: the seeded resource is closed Fridays, plus one sample holiday.
- Postman collection updated with a "4. Holidays & Hours" folder testing both closure types
  and the holiday-date unique constraint.

### Phase 4 — QR check-in ✅ DONE
- `services/qrCode.ts` — generates a QR code (base64 PNG data URL) encoding the raw
  `bookingRef`, on demand rather than stored, since it's fully derived data. Included in
  `POST /api/bookings` and `GET /api/bookings/:bookingRef` responses as `qrCode`.
- `services/bookingStateMachine.ts` — explicit allowed-transitions table
  (`BOOKED → CHECKED_IN/NO_SHOW/CANCELLED`, `CHECKED_IN → COMPLETED`) instead of letting any
  route set any status.
- `POST /api/bookings/:bookingRef/checkin` — the QR-scan/manual-entry endpoint. Validates the
  transition, records `checkedInAt`/`checkInMethod`, returns `isLate` (10-minute grace period).
- `POST /api/bookings/:bookingRef/no-show` and `.../complete` — staff-driven transitions.
  An automated no-show sweep (no human involved) is deferred to Phase 6 (Lambda + EventBridge).
- `GET /api/queue?resourceId&date` — staff "who's here / who's next" view for a resource's day,
  each booking flagged `isLate` if still `BOOKED` past the grace period.
- Frontend: `BookingDetailsPage` shows the QR image (as an `<img>` from the `qrCode` data URL)
  while a booking is still `BOOKED`. `/checkin` — staff manual-entry check-in form. `/queue` —
  resource + date picker showing every booking that day with inline Check In / No-Show /
  Complete action buttons, calling the matching state-machine endpoint and refreshing.
- **Interview angle:** state machines (booking status transitions), derived vs stored data.

### Phase 5 — Auth & roles ✅ DONE
- `User` model added to schema: email, `passwordHash` (bcrypt), `role` (STAFF/ADMIN enum), scoped
  to a `businessId`. No public registration endpoint — accounts are created by an ADMIN or by the
  seed script (bootstraps the first admin/staff so there's no chicken-and-egg problem).
- `services/auth.ts` — password hashing (`bcryptjs`) and JWT sign/verify (`jsonwebtoken`,
  8h expiry). Token payload: `{ userId, role, businessId }`.
- `middleware/auth.ts` — `requireAuth` (verifies `Authorization: Bearer <token>`, sets `req.user`)
  and `requireRole(...roles)` (403 if the logged-in user's role isn't allowed).
- `POST /api/auth/login` (public), `GET /api/auth/me` (any logged-in user), `POST /api/auth/users`
  and `GET /api/auth/users` (ADMIN only — how new staff accounts get created).
- Staff-facing endpoints now gated: `GET /api/resources`, `PATCH /api/resources/:id`,
  `GET/POST /api/holidays`, `DELETE /api/holidays/:id`, `GET /api/queue`, and the booking
  state-transition endpoints (`checkin`, `no-show`, `complete`) all require `requireAuth` +
  the appropriate role, plus an explicit **ownership check** (the record's `businessId` must
  match the logged-in user's `businessId` — ADMIN of Business A can't touch Business B's data).
- Customer-facing endpoints stay fully public by design: `POST /api/bookings`,
  `GET /api/bookings/:bookingRef`, `GET /api/slots`, `GET /api/services` — customers never log
  in, they prove ownership of a booking just by knowing its `bookingRef`.
- Design choice: JWT stored in the frontend's `localStorage` (not an httpOnly cookie) — simpler
  for a monolith + separate-origin dev setup, tradeoff is XSS exposure vs CSRF exposure.
- Seed script now creates two sample logins (idempotent — safe to re-run):
  `admin@sunriseclinic.test` / `AdminPass123!` (ADMIN) and `staff@sunriseclinic.test` /
  `StaffPass123!` (STAFF).
- Postman collection: new "0. Auth" folder (login as admin/staff, get current user, admin-creates-
  staff, a 403 test for a non-admin trying to create a user, list users) plus `Authorization`
  headers added to every request that's now gated, and two new negative tests (401 with no token,
  403 for staff attempting an admin-only action).
- **Interview angle:** authN vs authZ, JWT pitfalls (storage location, stateless revocation),
  RBAC vs ownership/tenancy checks, why there's no public signup endpoint.

Frontend:
- `auth/AuthContext.tsx` — React context holding `{ token, user }`, persisted to `localStorage`
  so a page refresh doesn't log the user out. `login()` calls `POST /api/auth/login`; `logout()`
  clears both state and storage.
- `auth/RequireAuth.tsx` — route guard component; redirects to `/login` (remembering the page
  the user was trying to reach) if there's no logged-in user.
- `pages/LoginPage.tsx` — email/password form using `useAuth().login()`, redirects back to the
  originally-requested page (or `/queue`) on success.
- `App.tsx` — `/checkin` and `/queue` routes now wrapped in `<RequireAuth>`; nav bar shows
  "Staff Login" when logged out, or the current user's email/role + a Log out button when
  logged in.
- `CheckInPage.tsx` and `QueuePage.tsx` — every fetch to a gated endpoint now sends
  `Authorization: Bearer <token>`; a `401` response triggers `logout()` and shows a "session
  expired" message instead of a confusing raw error.
- **Interview angle:** React context for cross-cutting concerns (auth) vs prop drilling,
  client-side route guards vs relying on the API alone, handling token expiry gracefully in the UI.

### Post-Phase 5 addition — Service management endpoints ✅ DONE
Closes a gap noticed while reviewing what admin UI would even need: `routes/services.ts` had
only ever had `GET`, so there was no way to add/edit/remove a service without hand-editing
`prisma/seed.ts` and re-seeding.
- `POST /api/services`, `PATCH /api/services/:id`, `DELETE /api/services/:id` — all ADMIN only.
  `GET /api/services` stays public (customers need it for the booking wizard).
- Same ownership-check pattern as holidays/resources/queue, but one step removed: `Service`
  has no `businessId` column of its own, so the check looks up the target `resourceId`'s
  business first and compares that — otherwise an admin could attach a service to another
  business's resource just by guessing its id.
- `DELETE` catches Prisma's `P2003` (foreign key violation) and returns a clean `409` instead
  of a raw 500 when a service still has bookings referencing it.
- Along the way, fixed a real type error in `services/auth.ts`'s `signToken` — the installed
  `@types/jsonwebtoken` types `expiresIn` as a template-literal type (`"8h"`, `"30m"`, etc.),
  not a plain `string`, so reading it from `process.env` needed an explicit cast.
- Postman collection: "Add/Update/Delete Service (Admin)" plus a 403 test for staff attempting
  to add one, in the "1. Health & Services" folder.

Frontend:
- `auth/useAuthFetch.ts` — a shared hook wrapping `fetch()` that attaches
  `Authorization: Bearer <token>` and logs the user out on a `401`. Introduced here because a
  third and fourth staff page (the new admin pages) would have meant a fourth copy of that
  logic; `CheckInPage`/`QueuePage` were refactored to use it too, closing a gap flagged back
  in the Phase 5 frontend interview-prep notes.
- `auth/RequireAuth.tsx` — extended with an optional `role` prop. Missing-auth still redirects
  to `/login` (a 401-shaped problem, fixable by logging in); a logged-in user with the wrong
  role gets an inline "Access denied" message instead (a 403-shaped problem, logging in again
  wouldn't help) — mirrors the distinction the backend itself makes.
- `pages/admin/AdminLayout.tsx` — shared shell with a Services/Holidays/Hours sub-nav and an
  `<Outlet/>`, mounted at `/admin` (nested routes, `<Route index>` redirects to `/admin/services`).
- `pages/admin/ServicesAdminPage.tsx` — add/edit/delete services. Uses the public
  `GET /api/services` response but filters to the admin's own resources client-side (the real
  ownership enforcement is server-side on the mutating endpoints — this filtering is just
  about what to show).
- `pages/admin/HolidaysAdminPage.tsx` — add/remove one-off closed dates.
- `pages/admin/HoursAdminPage.tsx` — per-resource working hours + weekly closed-day checkboxes.
- Nav bar shows an "Admin" link only when `user.role === "ADMIN"` (STAFF users don't see a
  link to a page they'd immediately be denied).
- **Interview angle:** when to introduce a shared abstraction (rule of three — two duplicates
  tolerated, a third triggers the refactor), 401 vs 403 as distinct UI states, nested routes
  with `<Outlet/>`, client-side filtering vs server-side authorization.

### Post-Phase 5 addition — Resource creation ✅ DONE
The last gap: there was no way to add a second doctor/stylist/chair without hand-editing
`prisma/seed.ts` and re-seeding. `resources.ts` only ever had `GET`/`PATCH`.
- `POST /api/resources` — ADMIN only, same "trust the token's `businessId`, never the body"
  pattern as every other create endpoint. Omitted `workingHoursStart`/`workingHoursEnd`/
  `closedWeekdays` fall back to the schema's own `@default` values instead of writing explicit
  nulls — passing `undefined` (not omitting the key) is what makes Prisma apply its defaults.
- Frontend: `pages/admin/ResourcesAdminPage.tsx` — a new first tab on `/admin` (name-only
  create form + a read-only list of existing resources with their hours/closed days).
  Deliberately kept separate from the Hours tab, which still owns *editing* an existing
  resource's hours — same create-vs-edit split as the backend's POST vs PATCH.
- Postman: "Add Resource (Admin)" + a 403 test for staff attempting one.
- **Interview angle:** letting a default value defined once in the schema (`@default("09:00")`)
  stay the single source of truth instead of duplicating it in application code — passing
  `undefined` for an omitted field vs `null` for "explicitly no value" is a subtle but real
  distinction in Prisma (and SQL `DEFAULT` in general).

### Post-Phase 5 addition — Frontend redesign (Material Design) ✅ DONE
The frontend worked but looked like unstyled HTML — every page used raw inline `style={}`
objects, no shared visual language, no responsive behavior beyond what the browser did by
default. Rebuilt on MUI (Material UI), the standard Material Design component library for React.
- `theme.ts` — one `createTheme()` call, the single source of truth for color palette (a
  clinical teal primary, warm amber secondary), corner radius, and typography. Wrapped with
  `responsiveFontSizes()` so heading sizes scale down on narrow viewports automatically.
- `main.tsx` — added `<ThemeProvider theme={theme}>` + `<CssBaseline/>` around the whole app;
  `CssBaseline` replaces the old hand-written `index.css` reset.
- `App.tsx` — nav rebuilt as an MUI `AppBar`/`Toolbar`. Above the `md` breakpoint (900px) it
  shows inline nav buttons; below it, a hamburger `IconButton` opens a `Drawer` with the same
  links as a list — one `useMediaQuery` call decides the layout for the whole nav instead of
  per-page media queries.
- Every page rebuilt with MUI components: `Card`/`CardContent` for forms and detail panels,
  `TextField`/`MenuItem` for inputs and selects, `Table`/`TableContainer` (which scrolls
  horizontally on narrow screens instead of squeezing columns) for lists, `Chip` for booking/
  queue status with color mapped to meaning (primary=booked, warning=checked-in,
  success=completed, error=no-show), `Alert` for errors/info instead of plain colored `<p>`
  tags, `Skeleton`/`CircularProgress` for loading states.
- `AdminLayout` switched from plain `NavLink`s to MUI `Tabs`; `HoursAdminPage`'s weekday
  picker switched from checkboxes to a `ToggleButtonGroup`.
- `RequireAuth`'s "access denied" message is now an `Alert` instead of a bare `<h1>`/`<p>`.
- `frontend/package.json` gained `@mui/material`, `@mui/icons-material`, `@emotion/react`,
  `@emotion/styled` — **run `npm install` in `frontend/` before `npm run dev`** or the app
  won't start.
- **Interview angle:** design tokens / theming (one file controlling color+type+shape app-wide
  vs scattered inline styles), the `sx` prop vs a CSS-in-JS library vs plain CSS, responsive
  design via breakpoints (`useMediaQuery`, responsive `sx` objects like `{ xs: ..., md: ... }`)
  vs media queries, component libraries as a way to get accessibility (focus states, ARIA
  roles) for free instead of reimplementing it per component.

### Post-Phase 5 addition — Business dashboard ✅ DONE
The old `/` page was just the Phase 1 health check (API/DB status) — useful during development,
not something a customer or staff member opening the app actually needs. Replaced it with two
things: a light public landing page, and a real staff-facing dashboard.
- `GET /api/dashboard/summary?date=YYYY-MM-DD` — new endpoint, STAFF or ADMIN, same access
  level as `/api/queue`. Unlike the queue (one resource's line at a time), this aggregates
  **every resource in the caller's business** for one day: booking counts by status
  (booked/checked-in/completed/no-show/cancelled), expected vs. completed revenue, and the
  next 5 upcoming bookings. Defaults to today if no `date` is given.
- Revenue is computed two ways on purpose: **expected** (booked + checked-in + completed —
  "what today should be worth if everyone shows up") and **completed** ("what's actually been
  collected so far"). A no-show's price is deliberately excluded from expected revenue — it's
  lost business, not revenue still coming.
- Frontend: `pages/DashboardPage.tsx` at `/dashboard` (auth required, no specific role — same
  level as Check-in/Queue) — KPI cards (booked/checked-in/completed/no-show), a revenue card
  with a completion-rate progress bar, a "next up" list, and quick-action buttons to the queue
  and manual check-in. `pages/HomePage.tsx` simplified to a public landing page (two CTA
  buttons: book, find booking) — the health-check card it used to show moved conceptually into
  the dashboard's territory (operational status isn't customer-facing content).
- Post-login redirect changed from `/queue` to `/dashboard` — a logged-in staff member's most
  useful landing page is now the business overview, not straight into one resource's queue.
- **Interview angle:** aggregation queries (grouping/summing across a relation) vs. row-level
  lookups, choosing what "today" means for a report (server's local day boundaries, same
  simplification `/api/queue` already made — a real timezone-aware version would use
  `Business.timezone`), designing an API response shape around what the UI needs to render
  in one request instead of forcing multiple round trips.

### Phase 6 — AWS deployment
- EC2 for the API, RDS for Postgres.
- S3 for storing generated QR images.
- SES for booking confirmation emails.
- Lambda + EventBridge for a scheduled no-show sweep job.
- **Interview angle:** EC2 vs Lambda tradeoffs, IAM roles, scaling a monolith.

### Phase 7 — Testing & polish
- Unit tests (services/repositories), integration tests (API + test DB).
- Load-test the booking endpoint to surface race conditions.
- Write up design decisions as interview talking points (system design story).

## Next step
Phase 6 — AWS deployment. Run the new Prisma migration + re-seed locally to pick up Phase 5's
`User` table, test the login flow end to end, then start planning EC2/RDS deployment.
