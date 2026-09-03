# Changelog

The development history of this project, kept as a build log rather than a release log —
this was built phase by phase as a learning project, and the reasoning behind each phase is
often more interesting than the diff. Newest first.

For the current state of the system, see [`README.md`](README.md). For the forward-looking
plan, see [`booking-system-roadmap.md`](booking-system-roadmap.md).

---

## Test suites (Vitest)

Backend and frontend test suites added. Backend runs against a **separate physical database**
(`booking_db_test`, configured in `.env.test`) rather than a different schema in the dev
database — so a bad `TRUNCATE` in test cleanup can never reach real dev data. `tests/setup.ts`
loads that env file before anything imports `db/prisma.ts`, and `REMINDERS_ENABLED=false`
keeps the reminder cron from racing against `resetDb()` between tests.

- Backend: 54 cases across 9 files — route-level tests via `supertest` (auth, bookings,
  favorites, health, staff notifications) plus pure-unit tests for the slot generator, booking
  state machine, notification templates, and notification settings validation.
- Frontend: 28 cases across 6 files — `@testing-library/react` on both auth contexts, both
  route guards, the notification bell, and the reschedule dialog.

## Cancellation, rescheduling & favourite services

- **Cancel / reschedule:** `POST /api/bookings/:bookingRef/cancel` and
  `PATCH /api/bookings/:bookingRef/reschedule` for customers, mirrored by
  `POST|PATCH /api/staff/bookings/:bookingRef/...` for staff acting on someone's behalf.
  Shared logic lives in `services/bookingLifecycle.ts` so the two paths can't drift.
  Rescheduling re-runs the same availability check booking creation uses, so it can't land on
  an occupied or already-elapsed slot.
- **Favourites:** new `FavoriteService` model and `/api/favorites` (list / add / remove), with
  a `/customer/favorites` page and a `RescheduleDialog` component on the frontend.

## Push & in-app notifications

Full write-up in [`push-notifications-plan.md`](push-notifications-plan.md).

- Four new tables: `DeviceToken`, `Notification`, `NotificationDelivery`,
  `NotificationSetting`.
- **One provider, both platforms:** Firebase Cloud Messaging relays to Apple's APNs
  server-side, so iOS registers with Firebase's `getToken()` exactly like Android — one SDK,
  one token format. `services/push.ts` is the only file that knows Firebase exists.
- **Store first, push second.** The `Notification` row is the source of truth, so the in-app
  list is complete even with no device registered or FCM down. Without `FIREBASE_*` env vars,
  `push.ts` logs to the console instead of sending — the same stand-in approach `services/otp.ts`
  uses for email, so the whole flow is testable with no Firebase project.
- **Reminders poll, they don't schedule.** A `node-cron` sweep every 5 minutes scans for
  bookings that just crossed a configured offset (6h and 1h by default, per-business
  configurable). Idempotency comes from a `UNIQUE` `dedupeKey` of
  `"<bookingId>:REMINDER:<offsetMins>"` — so cancels and reschedules need no timer cleanup, and
  a restart loses nothing.
- Check-in now pushes a confirmation the moment staff scan the QR code; staff can also send
  manual messages to up to 200 customers at once.
- Frontend: `NotificationBell`, `/customer/notifications`, `/staff/notifications`, and
  `/admin/notifications` (reminder offsets, toggles, quiet hours).

## Mobile app plan

Planning doc added — see [`mobile-app-plan.md`](mobile-app-plan.md) and
[`mobile-testing-plan.md`](mobile-testing-plan.md).

---

## Customer accounts (Phase 5.5)

Governing spec: [`customer-accounts-plan.md`](customer-accounts-plan.md).

### Backend

A second, fully separate identity system alongside staff `User` — self-service `Customer`
accounts, email + password, with email verification via a 6-digit OTP (console-logged, not
actually emailed). JWT payloads carry a `kind: "staff" | "customer"` discriminator, so a
customer token can never satisfy a staff-only route or vice versa, even if a route forgets a
role check.

New routes under `/api/customer/*`: `register`, `verify-otp`, `resend-otp`, `login`,
`forgot-password`, `reset-password`, `change-password`, `GET/PATCH me`, `POST me/picture`
(multer, local disk, 2 MB limit, jpeg/png/webp only), `GET bookings`.

`POST /api/bookings` moved from public to customer-authenticated — booking without an account
is no longer possible. Staff can still book on anyone's behalf via `POST /api/staff/bookings`
(existing customer by id, or a nameless walk-in) and `GET /api/staff/customers?search=`. Both
reuse the same `services/bookingCreation.ts` the customer flow uses, so slot
validation/idempotency isn't duplicated.

### Frontend

Staff login moved to `/staff/login`, full URL symmetry with the new `/customer/*` space. A
second, fully independent `CustomerAuthContext` — separate `localStorage` keys, separate token,
separate `useCustomerAuthFetch` / `RequireCustomerAuth` guard. Never unified with the staff
`AuthContext`, same reasoning as the backend's `kind`-based JWT split. Both sessions can be
signed in at once on the same device, with distinct slots in the `AppBar`.

`BookPage` lost its customer-info form entirely — replaced by a "Booking as `<name>`" line
pulled from the logged-in profile, matching the backend no longer accepting customer fields in
the request body.

### Follow-up fixes

- **Nav separation:** the top nav used to be one shared list shown to everyone, so a logged-in
  customer saw staff-only links like Dashboard. Split into `STAFF_NAV_ITEMS` and
  `CUSTOMER_NAV_ITEMS`, driven by whether a staff session exists. `/find-booking` moved from
  public to staff-only as part of this — it's a front-desk lookup tool, not customer
  self-service (that's "My bookings").
- **My bookings moved out of the account tabs:** booking history is what a customer came to
  look at, not an account setting, so it became its own route (`/customer/bookings`) rather
  than a tab under `/customer/account/*`.
- **Services → Book handoff:** each service row got a "Book" button linking to
  `/book?serviceId=<id>`. Passed as a query param rather than route state specifically so it
  survives a login redirect — `RequireCustomerAuth` preserves `pathname + search`, so an
  anonymous visitor who clicks "Book" still lands on that pre-selected service after logging in.
- **No booking an already-elapsed slot:** `getAvailableSlots()` — the one function both
  `GET /api/slots` and every booking-creation path run through — now excludes slots whose
  start time has passed, the same way it excludes booked ones. One change covers both the
  picker and a real server-side guard. Date pickers gained `min={today}`, and the Postman
  collection's `date` variable became a computed pre-request script instead of a hardcoded
  string that would silently start returning empty lists.

---

## Phase 5 — Staff authentication

### Backend

New `User` model (email, bcrypt `passwordHash`, STAFF/ADMIN role, scoped to a `businessId`) —
no public signup; accounts come from an ADMIN or the seed script. `services/auth.ts` (hashing +
JWT) and `middleware/auth.ts` (`requireAuth`, `requireRole(...roles)`). New routes:
`POST /api/auth/login`, `GET /api/auth/me`, `POST|GET /api/auth/users` (ADMIN only).

Every staff-facing endpoint from earlier phases now requires login **plus** an ownership check
tying the record's `businessId` to the logged-in user's own business.

### Frontend

`AuthContext` (token + user, persisted to `localStorage`), `RequireAuth` route guard, and a
login page. Staff pages send `Authorization: Bearer <token>` and log out automatically on 401.

### Post-Phase-5 additions

- **Service management endpoints:** `POST/PATCH/DELETE /api/services` were missing entirely —
  services could only be seeded, never created through the API. ADMIN-only, ownership checked
  via the service's resource (`Service` has no `businessId` of its own).
- **Admin settings UI:** `/admin/services`, `/admin/holidays`, `/admin/hours` — gated to the
  ADMIN role specifically, not just "logged in". Introduced `useAuthFetch`, a shared
  fetch-with-auth-and-401-handling hook, replacing that logic repeated across four pages.
- **Resource creation:** `POST /api/resources` was the last missing piece — there was no way to
  add a second doctor/chair without editing the seed script. New `/admin/resources` tab.
- **Frontend redesign:** every page rebuilt on MUI — a real theme (`theme.ts`: palette, corner
  radius, typography, responsive font scaling), an `AppBar` that collapses into a `Drawer`
  below 900 px, and `Card`/`TextField`/`Table`/`Chip`/`Alert` instead of raw inline styles.
- **Business dashboard:** `GET /api/dashboard/summary` aggregates every resource in the
  business for one day — counts by status, expected vs. completed revenue, next 5 bookings.
  `/dashboard` became where staff land after login; `/` simplified to a public landing page.

---

## Phase 4 — QR check-in

- QR codes generated on demand (`services/qrCode.ts`), encoding the raw `bookingRef` and
  returned as a data URL — nothing stored in the database.
- An explicit state machine (`services/bookingStateMachine.ts`) governs status changes, so
  nonsense like completing a cancelled booking is impossible by construction.
- `POST /api/bookings/:bookingRef/checkin` (returns `isLate`), `.../no-show`, `.../complete`.
- `GET /api/queue?resourceId&date` — the staff "who's here / who's next" view.
- Frontend: QR shown on the booking details page while still `BOOKED`; `/checkin` manual-entry
  form; `/queue` day view with inline action buttons.

## Phase 3 — Slots & bookings

- `GET /api/slots` computes open slots from working hours minus existing bookings.
- `POST /api/bookings` validates the slot is open, with double-booking blocked **twice**: an
  application-level check, and a `@@unique([resourceId, startTime])` database constraint. The
  constraint is the real backstop — the application check alone loses a check-then-act race.
- Optional `idempotencyKey` for safe retries on a flaky network.
- Frontend: the `/book` wizard (service → date → slot → submit, with 409 handling that
  refreshes the slot list), `/find-booking`, and `/bookings/:bookingRef`.
- A Postman collection covering every endpoint, including dedicated requests demonstrating the
  double-booking rejection and the idempotent retry.

### Holidays & working hours (post-Phase-3)

`Resource.closedWeekdays` (e.g. closed every Friday) and a `Holiday` model (one-off closed
dates) are now respected by slot generation — a fully closed day returns an empty list plus a
`note` explaining why. `GET /api/slots` changed shape from a bare array to `{ slots, note }`.

## Phase 2 — Prisma & routing

- Prisma replaced raw `pg` as ORM and migration tool. Schema defined
  Business/Resource/Service/Booking. Seed script added.
- Frontend gained React Router; `/services` renders real seeded data.

## Phase 1 — Scaffold

Backend (Express + TypeScript) and frontend (React + TypeScript via Vite) scaffolded and wired
end to end through Postgres — `/api/health` confirming `dbConnected: true`.

---

## Troubleshooting resolved along the way

Kept because these were the actual time sinks: a wrong-directory `npm install`; a port-5432
conflict with an existing Postgres container; creating `booking_user`/`booking_db` inside that
container; granting `booking_user` `CREATEDB` so Prisma's shadow database could be created;
recovering from an accidental empty GitHub Desktop repo that shadowed the real one; and a
duplicate-data bug caused by re-running a seed script that wasn't yet idempotent.
