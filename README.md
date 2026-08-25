# Booking System

Backend (Express + TypeScript + Postgres) and frontend (React + TypeScript via Vite),
wired together with a health-check call so you can confirm both apps and the database talk to each other.

See `booking-system-roadmap.md` (in this folder) for the full 7-phase plan.

## Current status: Phases 1-5 ✅ done. Starting Phase 6 (AWS deployment).

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

### What's next — Phase 6: AWS deployment
- EC2 for the API, RDS for Postgres, S3 for QR images, SES for confirmation emails.
- Lambda + EventBridge for a scheduled no-show sweep.

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
npx prisma migrate dev --name add_users_auth
npm run seed
npm run dev
```
`npm install` also generates the Prisma Client automatically. `prisma migrate dev` creates/updates the
tables in Postgres from `schema.prisma` (re-run it whenever the schema changes — this one adds the new
`User` table for Phase 5). `npm run seed` inserts one sample business/resource/services, a Friday weekly
closure, one sample holiday, and two sample logins for testing:
- **Admin:** `admin@sunriseclinic.test` / `AdminPass123!`
- **Staff:** `staff@sunriseclinic.test` / `StaffPass123!`

Backend runs on http://localhost:4000. Check it directly:
- http://localhost:4000/api/health
- http://localhost:4000/api/services
- http://localhost:4000/api/slots?resourceId=...&serviceId=...&date=2026-08-25 (grab real IDs from `/api/services` first)
- `/api/resources`, `/api/holidays`, `/api/queue` now require a login — use the Postman
  collection's "0. Auth" folder to get a token, then send it as `Authorization: Bearer <token>`.

## 3. Run the frontend
```
cd frontend
npm install
npm run dev
```
Frontend runs on http://localhost:5173. Open it in a browser — it calls `/api/health`
(proxied to the backend by Vite, see `vite.config.ts`) and shows API status, DB connection,
and server time. If you see "Backend not reachable," make sure the backend is running.

## What's here
```
booking-system/
├── docker-compose.yml         # Postgres for local dev
├── backend/
│   ├── prisma/schema.prisma   # Business/Resource/Service/Booking/User models
│   ├── prisma/seed.ts         # sample data + sample admin/staff logins
│   ├── src/index.ts           # Express app entrypoint
│   ├── src/routes/health.ts   # GET /api/health
│   ├── src/routes/services.ts # GET /api/services
│   ├── src/routes/slots.ts    # GET /api/slots
│   ├── src/routes/bookings.ts # POST /api/bookings, GET .../:bookingRef, POST .../checkin|no-show|complete
│   ├── src/routes/holidays.ts # GET/POST /api/holidays, DELETE /api/holidays/:id
│   ├── src/routes/resources.ts # GET /api/resources, PATCH /api/resources/:id
│   ├── src/routes/queue.ts    # GET /api/queue — staff "who's here/next" view
│   ├── src/routes/auth.ts     # POST /api/auth/login, GET .../me, POST/GET .../users
│   ├── src/services/slotGenerator.ts # pure function: working hours -> candidate slots
│   ├── src/services/availability.ts  # candidates minus bookings minus holidays/closed days
│   ├── src/services/qrCode.ts # generates a QR data URL from a bookingRef
│   ├── src/services/bookingStateMachine.ts # allowed BookingStatus transitions
│   ├── src/services/auth.ts   # password hashing (bcrypt) + JWT sign/verify
│   ├── src/middleware/auth.ts # requireAuth, requireRole(...roles) middleware
│   ├── src/types/express.d.ts # adds req.user to Express's Request type
│   └── src/db/prisma.ts       # shared Prisma Client instance
├── postman/booking-system.postman_collection.json # importable API test collection
└── frontend/
    ├── src/App.tsx             # Layout shell + routes (nav bar, <Routes>)
    ├── src/main.tsx            # React entrypoint, wraps App in BrowserRouter + AuthProvider
    ├── src/auth/AuthContext.tsx # login/logout, token+user persisted to localStorage
    ├── src/auth/RequireAuth.tsx # route guard — redirects to /login if logged out
    ├── src/pages/LoginPage.tsx # "/login" — staff/admin login form
    ├── src/pages/HomePage.tsx  # "/" — health check
    ├── src/pages/ServicesPage.tsx # "/services" — real seeded data from GET /api/services
    ├── src/pages/BookPage.tsx  # "/book" — the booking wizard
    ├── src/pages/FindBookingPage.tsx    # "/find-booking" — manual lookup form
    ├── src/pages/BookingDetailsPage.tsx # "/bookings/:bookingRef" — booking details + QR
    ├── src/pages/CheckInPage.tsx        # "/checkin" — staff manual check-in form (auth required)
    └── src/pages/QueuePage.tsx          # "/queue" — staff day view with action buttons (auth required)
```

## Next steps
Phase 6: AWS deployment — EC2 for the API, RDS for Postgres, S3 for QR images, SES for
confirmation emails, Lambda + EventBridge for a scheduled no-show sweep. Full plan in the
roadmap doc.
