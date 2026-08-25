# Booking System

Backend (Express + TypeScript + Postgres) and frontend (React + TypeScript via Vite),
wired together with a health-check call so you can confirm both apps and the database talk to each other.

See `booking-system-roadmap.md` (in this folder) for the full 7-phase plan.

## Current status: Phases 1-5 ✅ done. Customer accounts (backend + frontend) ✅ done. Phase 6 (AWS deployment) next.

### What's done so far
- **Phase 1:** Backend (Express+TS) and frontend (React+TS/Vite) scaffolded and wired end-to-end
  through Postgres — `/api/health` confirms `dbConnected: true`.
- **Phase 2 (backend):** Prisma added as ORM + migration tool (replaced raw `pg`). Schema defines
  Business/Resource/Service/Booking models. Seed script adds sample data. New `GET /api/services`
  endpoint proves schema+migration+seed work together. Health check now uses `prisma.$queryRaw`.
- **Phase 2 (frontend):** React Router added. `App.tsx` is now a layout shell with a nav bar;
  `/` shows the health check, `/services` fetches and renders the real seeded services in a table.
- **Phase 3 (backend):** `GET /api/slots` computes open slots from working hours minus existing
  bookings. `POST /api/bookings` validates the slot is open and creates it — double-booking is
  blocked both by an application check and a `@@unique([resourceId, startTime])` DB constraint
  (the real backstop against race conditions). Supports an optional `idempotencyKey` for safe
  retries. `GET /api/bookings/:bookingRef` is the public lookup Phase 4's QR check-in will use.
  A Postman collection (`postman/`) covers every endpoint, with dedicated requests demonstrating
  the double-booking rejection and the idempotent retry.
- **Phase 3 (frontend):** `/book` — a full booking wizard (service → date → open slots →
  customer info → submit, with 409 handling that refreshes the slot list). `/find-booking` —
  manual booking-reference lookup. `/bookings/:bookingRef` — details page shared by both flows.
- **Holidays & working hours (post-Phase 3 addition):** `Resource.closedWeekdays` (e.g. closed every
  Friday) and a new `Holiday` model (one-off closed dates per business) are now respected by slot
  generation — a fully closed day returns an empty slot list plus a `note` explaining why.
  New endpoints: `GET/POST /api/holidays`, `DELETE /api/holidays/:id`, `GET /api/resources`,
  `PATCH /api/resources/:id` (all unauthenticated for now — will be gated in Phase 5). `GET /api/slots`
  response shape changed from a bare array to `{ slots, note }`; frontend updated to match.
- **Phase 4 (backend):** QR codes generated on demand (`services/qrCode.ts`, encodes the raw
  `bookingRef`, returned as `qrCode` in booking create/lookup responses — nothing stored in the
  DB). An explicit state machine (`services/bookingStateMachine.ts`) governs status changes.
  `POST /api/bookings/:bookingRef/checkin` (the QR-scan/manual endpoint, returns `isLate`),
  `.../no-show`, `.../complete` for staff-driven transitions. `GET /api/queue?resourceId&date`
  is the staff "who's here / who's next" view.
- **Phase 4 (frontend):** `BookingDetailsPage` shows the QR image while a booking is still
  `BOOKED`. `/checkin` — staff manual-entry check-in form. `/queue` — resource + date picker
  with inline Check In / No-Show / Complete buttons per booking.
- Troubleshooting resolved along the way: fixed a wrong-directory `npm install`, a port-5432 conflict
  with an existing Postgres container, created `booking_user`/`booking_db` inside that container,
  granted `booking_user` `CREATEDB` so Prisma's shadow database could be created, recovered from
  an accidental empty GitHub Desktop repo that shadowed the real one, and fixed a duplicate-data
  bug caused by re-running the (previously non-idempotent) seed script.
- **Phase 5 (backend):** New `User` model (email, bcrypt `passwordHash`, STAFF/ADMIN role, scoped
  to a `businessId`) — no public signup, accounts come from an ADMIN or the seed script.
  `services/auth.ts` (password hashing + JWT sign/verify) and `middleware/auth.ts`
  (`requireAuth`, `requireRole(...roles)`). New routes: `POST /api/auth/login` (public),
  `GET /api/auth/me`, `POST /api/auth/users` + `GET /api/auth/users` (ADMIN only). Every
  staff-facing endpoint from earlier phases (`resources`, `holidays`, `queue`, and the booking
  `checkin`/`no-show`/`complete` transitions) now requires login plus an ownership check tying
  the record's `businessId` to the logged-in user's own business. Customer-facing endpoints
  (`bookings` create/lookup, `slots`, `services`) stay public — customers never log in. Seed
  script now creates two sample logins for testing (see Prerequisites below).
- **Phase 5 (frontend):** `auth/AuthContext.tsx` — React context holding `{ token, user }`,
  persisted to `localStorage`. `auth/RequireAuth.tsx` — route guard, redirects to `/login` if
  logged out. `pages/LoginPage.tsx` — email/password form. `/checkin` and `/queue` routes are
  now wrapped in `RequireAuth`; both pages send `Authorization: Bearer <token>` on every
  request and log the user out automatically on a `401`. Nav bar shows a login link when
  logged out, or the current user's email/role + a logout button when logged in.
- **Service management endpoints (post-Phase 5 addition, backend):** `POST/PATCH/DELETE /api/services`
  were missing entirely — services could only ever be seeded, never created or edited through
  the API. Now ADMIN-only, same ownership-check pattern as holidays/resources (looked up via
  the service's resource, since `Service` has no `businessId` of its own). `GET /api/services`
  stays public. Also fixed a real type error in `signToken` surfaced once `@types/jsonwebtoken`
  was actually installed.
- **Admin settings UI (post-Phase 5 addition, frontend):** `/admin/services`, `/admin/holidays`,
  `/admin/hours` — the screens that finally use the endpoints above and the existing
  holidays/resources endpoints, gated to the ADMIN role specifically (not just "logged in").
  Introduced `auth/useAuthFetch.ts`, a shared fetch-with-auth-header-and-401-handling hook, and
  refactored `CheckInPage`/`QueuePage` to use it instead of repeating that logic a third and
  fourth time.
- **Resource creation (post-Phase 5 addition):** `POST /api/resources` was the last missing
  piece — there was previously no way to add a second doctor/stylist/chair without editing the
  seed script. ADMIN only, same pattern as services/holidays. New `/admin/resources` tab (name
  + a list of existing resources); editing an existing resource's hours still happens on the
  `/admin/hours` tab.
- **Frontend redesign (post-Phase 5 addition):** rebuilt every page on MUI (Material UI) —
  a real theme (`theme.ts`: color palette, corner radius, typography, responsive font
  scaling), an `AppBar` nav that collapses into a `Drawer` below 900px, `Card`/`TextField`/
  `Table`/`Chip`/`Alert` everywhere instead of raw inline styles. **New dependency — run
  `npm install` in `frontend/` before `npm run dev`.**
- **Business dashboard (post-Phase 5 addition):** new `GET /api/dashboard/summary` (STAFF/
  ADMIN) aggregates every resource in the business for one day — booking counts by status,
  expected vs. completed revenue, next 5 upcoming bookings. New `/dashboard` page (KPI cards,
  revenue + completion-rate, next-up list, quick actions) is now where staff land after
  logging in. `/` (Home) simplified to a public landing page with just "Book" and "Find my
  booking" — the old health-check status card is gone from there.

- **Customer accounts (backend, post-Phase 5 addition):** a second, fully separate identity
  system alongside staff `User` — self-service `Customer` accounts, email + password, with
  email verification via a 6-digit OTP (console-logged for now, not actually emailed — see
  `customer-accounts-plan.md`). JWT payloads now carry a `kind: "staff" | "customer"`
  discriminator so a customer token can never satisfy a staff-only route or vice versa, even if
  a route forgets a role check. New routes under `/api/customer/*`: `register`, `verify-otp`,
  `resend-otp`, `login`, `forgot-password`, `reset-password`, `change-password`, `GET/PATCH me`,
  `POST me/picture` (multer, local disk — `/uploads/profile-pictures/`, 2MB limit,
  jpeg/png/webp only), `GET bookings` (own booking history). **`POST /api/bookings` (customer
  self-service booking) now requires a customer login** — booking without an account is no
  longer possible, matching the "sign in to book" requirement. Staff can still book on behalf
  of anyone via the new `POST /api/staff/bookings` (existing customer by id, or a nameless
  walk-in) and `GET /api/staff/customers?search=` — both reuse the same shared
  `services/bookingCreation.ts` the customer flow uses, so slot validation/idempotency logic
  isn't duplicated a third time. **Needs a fresh `npx prisma migrate dev` (adds `Customer`,
  `OtpCode`, `Booking.customerId`) and `npm install` in `backend/` (adds `multer`) before it
  runs** — see Prerequisites below.

- **Customer accounts (frontend, post-Phase 5 addition):** staff login moved to
  `/staff/login`, full URL symmetry with the new `/customer/*` space. A second, fully
  independent `CustomerAuthContext` (separate `localStorage` keys, separate token, separate
  `useCustomerAuthFetch`/`RequireCustomerAuth` guard) — never unified with the staff
  `AuthContext`, same reasoning as the backend's `kind`-based JWT split. New pages:
  `/customer/register`, `/customer/verify` (OTP entry, auto-logs-in on success),
  `/customer/login`, `/customer/forgot-password`, `/customer/reset-password`; a tabbed
  `/customer/account/*` section (`CustomerAccountLayout`, mirroring `AdminLayout`'s pattern)
  for Profile (name/phone + picture upload via `multer`), My bookings (own history), and
  Security (change password). `BookPage` (`/book`) is now wrapped in `RequireCustomerAuth` —
  the customer-info form is gone entirely, replaced by a "Booking as `<name>`" line pulled
  from the logged-in profile, matching the backend no longer accepting customer fields in the
  request body. The `AppBar` gained a second identity slot — an avatar/menu for the customer
  session, kept visually distinct from the staff login chip, both able to be signed in at once
  on the same device. New `/staff/bookings/new` (`StaffBookingPage`) lets staff search for an
  existing customer or fall back to a plain name+phone walk-in, calling the new
  `POST /api/staff/bookings`; linked from the Queue page and the Dashboard's quick actions.
- **Nav separation (post-customer-accounts fix):** the top nav used to be one shared list
  (Home/Dashboard/Services/Book/Find booking/Check-in/Queue) shown to everyone, so a logged-in
  customer saw staff-only links like Dashboard sitting right next to Book. Split into
  `STAFF_NAV_ITEMS` (Dashboard, Queue, Check-in, Find booking, New booking) and
  `CUSTOMER_NAV_ITEMS` (Home, Services, Book, My bookings, Profile); which one renders is
  driven by whether a staff session exists, independent of whether a customer is also logged
  in on the same device. `/find-booking` also moved from public to `RequireAuth` (staff-only)
  as part of this — it's now a front-desk lookup tool, not a customer self-service page (that's
  "My bookings" now). `HomePage` and `BookingDetailsPage`'s error state, which both used to
  link to `/find-booking`, were updated to point at `/customer/bookings` instead.
- **My bookings moved out of the account tabs (nav fix):** originally a third tab in
  `CustomerAccountLayout` alongside Profile/Security. Booking history is what a customer came
  to look at, not an account setting, so it's now its own standalone route
  (`/customer/bookings`), not nested under `/customer/account/*`. Every link that pointed at
  the old `/customer/account/bookings` path (top nav, the AppBar avatar menu, the mobile
  drawer, `HomePage`, `BookingDetailsPage`'s error state) was updated to match.
- **Services → Book handoff:** `/services` is now `RequireCustomerAuth`-gated (was public).
  Each row has a "Book" button linking to `/book?serviceId=<id>`; `BookPage` reads that query
  param once its own service list loads and pre-selects it, so the wizard opens with the
  service already chosen instead of the visitor picking it again. Passed as a query param
  rather than route state specifically so it survives a login redirect —
  `RequireCustomerAuth` now preserves `pathname + search` (previously pathname only), so an
  anonymous visitor who clicks "Book" for a specific service still lands back on that same
  pre-selected service after logging in, not a blank wizard.
- **No booking an already-elapsed slot:** `services/availability.ts`'s `getAvailableSlots()`
  — the single function both `GET /api/slots` and every booking-creation path
  (`POST /api/bookings`, `POST /api/staff/bookings`) already run through — now also excludes
  any candidate slot whose `startTime` has already passed, the same way it already excludes
  already-booked ones (removed from the list, not shown-but-disabled). One change covers both
  the picker (elapsed times just don't appear) and a real server-side guard (a stale or
  replayed request trying to book one gets the same 409 "not available" double-booking already
  triggers, so the existing refresh-on-409 frontend handling covers it with no new code).
  `BookPage`/`StaffBookingPage`'s date pickers also gained `min={today}` so a past date can't
  be selected at all. The Postman collection's `date` variable is now computed fresh by a
  collection-level Pre-request Script (was a hardcoded string) so it doesn't silently start
  returning empty slot lists once real-world "today" passes the date this collection was
  authored on.

### What's next
- **Phase 6: AWS deployment** — EC2 for the API, RDS for Postgres, S3 for QR images and
  profile pictures (replacing local disk), SES for actually sending the OTP emails (replacing
  console-log), Lambda + EventBridge for a scheduled no-show sweep.

## Prerequisites
- Node.js 18+ and npm
- Docker (for Postgres) — or a local Postgres instance if you'd rather not use Docker

## 1. Start Postgres
```
docker compose up -d
```
This starts Postgres on `localhost:5432` with user `booking_user` / password `booking_pass` / db `booking_db` (see `docker-compose.yml`).

## 2. Run the backend
```
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name add_customer_accounts
npm run seed
npm run dev
```
`npm install` also generates the Prisma Client automatically, and pulls in `multer` (profile
picture uploads — new dependency for the customer-accounts feature). `prisma migrate dev`
creates/updates the tables in Postgres from `schema.prisma` (re-run it whenever the schema
changes — this one adds `Customer`, `OtpCode`, and `Booking.customerId`). `npm run seed` inserts
one sample business/resource/services, a Friday weekly closure, one sample holiday, and two
sample **staff** logins for testing:
- **Admin:** `admin@sunriseclinic.test` / `AdminPass123!`
- **Staff:** `staff@sunriseclinic.test` / `StaffPass123!`

There's no seeded customer account — customers self-register via `POST /api/customer/register`
(see the Postman collection's "0. Auth" folder, or the frontend once built). Since OTP delivery
is console-log-only for now, watch the backend terminal for the verification code after
registering.

Backend runs on http://localhost:4000. Check it directly:
- http://localhost:4000/api/health
- http://localhost:4000/api/services
- http://localhost:4000/api/slots?resourceId=...&serviceId=...&date=2026-08-25 (grab real IDs from `/api/services` first)
- `/api/resources`, `/api/holidays`, `/api/queue` now require a **staff** login — use the
  Postman collection's "0. Auth" folder to get a token, then send it as
  `Authorization: Bearer <token>`.
- Creating/editing services (`POST/PATCH/DELETE /api/services`) requires an ADMIN token specifically.
- `POST /api/bookings` (customer self-service booking) now requires a **customer** login —
  register + verify via `/api/customer/*` first. Staff booking on someone's behalf uses the
  separate `POST /api/staff/bookings` instead, which takes a staff token.

## 3. Run the frontend
```
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:5173. `/` is the public landing page; `/staff/login` is
where staff/admin sign in (sample accounts above); `/customer/register` is where a customer
creates an account (needed before `/book` will let them through — it's gated behind
`RequireCustomerAuth`). If you see "Backend not reachable," make sure the backend is running.

## What's here
```
booking-system/
├── docker-compose.yml         # Postgres for local dev
├── customer-accounts-plan.md  # governing spec for the customer-accounts feature (13-step rollout)
├── backend/
│   ├── prisma/schema.prisma   # Business/Resource/Service/Booking/User/Customer/OtpCode models
│   ├── prisma/seed.ts         # sample data + sample admin/staff logins
│   ├── src/index.ts           # Express app entrypoint
│   ├── src/routes/health.ts   # GET /api/health
│   ├── src/routes/services.ts # GET /api/services (public), POST/PATCH/DELETE (admin)
│   ├── src/routes/slots.ts    # GET /api/slots
│   ├── src/routes/bookings.ts # POST /api/bookings (customer auth), GET .../:bookingRef, POST .../checkin|no-show|complete (staff)
│   ├── src/routes/holidays.ts # GET/POST /api/holidays, DELETE /api/holidays/:id
│   ├── src/routes/resources.ts # GET/POST /api/resources, PATCH /api/resources/:id
│   ├── src/routes/queue.ts    # GET /api/queue — staff "who's here/next" view
│   ├── src/routes/auth.ts     # POST /api/auth/login (staff), GET .../me, POST/GET .../users
│   ├── src/routes/dashboard.ts # GET /api/dashboard/summary — business-wide daily stats
│   ├── src/routes/customer.ts # /api/customer/* — register/verify/login/forgot/reset/change-password/me/bookings
│   ├── src/routes/staffBookings.ts # /api/staff/customers (search), /api/staff/bookings (walk-ins + existing customers)
│   ├── src/services/slotGenerator.ts # pure function: working hours -> candidate slots
│   ├── src/services/availability.ts  # candidates minus bookings minus holidays/closed days
│   ├── src/services/qrCode.ts # generates a QR data URL from a bookingRef
│   ├── src/services/bookingStateMachine.ts # allowed BookingStatus transitions
│   ├── src/services/bookingCreation.ts # shared createBooking() used by both customer + staff booking routes
│   ├── src/services/auth.ts   # staff password hashing (bcrypt) + JWT sign/verify (kind: "staff")
│   ├── src/services/customerAuth.ts # customer JWT sign/verify (kind: "customer")
│   ├── src/services/otp.ts    # OTP generate/verify — hashed, expiring, rate-limited (console-logged, not emailed)
│   ├── src/services/upload.ts # multer config — profile picture uploads to local disk
│   ├── src/middleware/auth.ts # requireAuth, requireRole(...roles) — staff
│   ├── src/middleware/customerAuth.ts # requireCustomerAuth
│   ├── src/types/express.d.ts # adds req.user (staff) and req.customer to Express's Request type
│   └── src/db/prisma.ts       # shared Prisma Client instance
├── postman/booking-system.postman_collection.json # importable API test collection
└── frontend/
    ├── src/theme.ts            # MUI theme — palette, shape, typography (single source of truth)
    ├── src/App.tsx             # Layout shell + routes (MUI AppBar/Drawer nav, dual identity slots, <Routes>)
    ├── src/main.tsx            # React entrypoint — ThemeProvider + CssBaseline, BrowserRouter, AuthProvider + CustomerAuthProvider
    ├── src/auth/AuthContext.tsx # staff login/logout, token+user persisted to localStorage
    ├── src/auth/RequireAuth.tsx # staff route guard — redirects to /staff/login if logged out, or shows
    │                            #   "access denied" if logged in with the wrong role
    ├── src/auth/useAuthFetch.ts # shared fetch wrapper: attaches staff token, logs out on 401
    ├── src/auth/CustomerAuthContext.tsx # customer login/logout, separate token+localStorage keys from staff
    ├── src/auth/RequireCustomerAuth.tsx # customer route guard — redirects to /customer/login
    ├── src/auth/useCustomerAuthFetch.ts # customer equivalent of useAuthFetch
    ├── src/pages/StaffLoginPage.tsx # "/staff/login" — staff/admin login form (renamed from /login)
    ├── src/pages/StaffBookingPage.tsx # "/staff/bookings/new" — staff books for an existing customer or a walk-in
    ├── src/pages/HomePage.tsx  # "/" — public landing page (book / find booking CTAs)
    ├── src/pages/DashboardPage.tsx # "/dashboard" — business-wide daily stats (auth required)
    ├── src/pages/ServicesPage.tsx # "/services" — service list from GET /api/services, per-row "Book" button (customer login required)
    ├── src/pages/BookPage.tsx  # "/book" — the booking wizard (customer login required), pre-selects ?serviceId= if present
    ├── src/pages/FindBookingPage.tsx    # "/find-booking" — manual lookup form (staff-only, auth required)
    ├── src/pages/BookingDetailsPage.tsx # "/bookings/:bookingRef" — booking details + QR
    ├── src/pages/CheckInPage.tsx        # "/checkin" — staff manual check-in form (auth required)
    ├── src/pages/QueuePage.tsx          # "/queue" — staff day view with action buttons (auth required)
    ├── src/pages/customer/
    │   ├── CustomerRegisterPage.tsx  # "/customer/register"
    │   ├── CustomerVerifyPage.tsx    # "/customer/verify" — OTP entry, auto-logs-in on success
    │   ├── CustomerLoginPage.tsx     # "/customer/login"
    │   ├── CustomerForgotPasswordPage.tsx # "/customer/forgot-password"
    │   ├── CustomerResetPasswordPage.tsx  # "/customer/reset-password"
    │   ├── CustomerAccountLayout.tsx      # "/customer/account" shell — Profile/Security tabs + <Outlet/>
    │   ├── CustomerProfilePage.tsx        # "/customer/account/profile" — name/phone + picture upload
    │   ├── CustomerSecurityPage.tsx       # "/customer/account/security" — change password
    │   └── CustomerBookingsPage.tsx       # "/customer/bookings" — standalone, own booking history (not an account tab)
    └── src/pages/admin/
        ├── AdminLayout.tsx      # "/admin" shell — Resources/Services/Holidays/Hours sub-nav + <Outlet/>
        ├── ResourcesAdminPage.tsx # "/admin/resources" — create a new resource (admin only)
        ├── ServicesAdminPage.tsx # "/admin/services" — add/edit/delete services (admin only)
        ├── HolidaysAdminPage.tsx # "/admin/holidays" — add/remove one-off closed dates
        └── HoursAdminPage.tsx    # "/admin/hours" — per-resource working hours + closed weekdays
```

## Next steps
Phase 6: AWS deployment — EC2 for the API, RDS for Postgres, S3 for QR images and profile
pictures (replacing local disk), SES for the OTP/confirmation emails (replacing console-log),
Lambda + EventBridge for a scheduled no-show sweep. Full plan in the roadmap doc.
