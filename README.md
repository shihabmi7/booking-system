# Booking System

Backend (Express + TypeScript + Postgres) and frontend (React + TypeScript via Vite),
wired together with a health-check call so you can confirm both apps and the database talk to each other.

See `booking-system-roadmap.md` (in this folder) for the full 7-phase plan.

## Current status: Phase 1 ✅ done. Phase 2 ✅ done. Phase 3 ✅ done. Starting Phase 4.

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
- Troubleshooting resolved along the way: fixed a wrong-directory `npm install`, a port-5432 conflict
  with an existing Postgres container, created `booking_user`/`booking_db` inside that container,
  granted `booking_user` `CREATEDB` so Prisma's shadow database could be created, and recovered from
  an accidental empty GitHub Desktop repo that shadowed the real one.

### What's next — Phase 4: QR check-in
- Generate a QR code (encoding the bookingRef) on booking confirmation.
- Check-in endpoint: mark `checkedInAt`/`checkInMethod`, flag late arrivals.
- Staff-facing "who's here / who's next" queue view.

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
npx prisma migrate dev --name add_holidays_and_closed_weekdays
npm run seed
npm run dev
```
`npm install` also generates the Prisma Client automatically. `prisma migrate dev` creates/updates the
tables in Postgres from `schema.prisma` (re-run it whenever the schema changes). `npm run seed` inserts
one sample business/resource/services, plus a Friday weekly closure and one sample holiday.

Backend runs on http://localhost:4000. Check it directly:
- http://localhost:4000/api/health
- http://localhost:4000/api/services
- http://localhost:4000/api/slots?resourceId=...&serviceId=...&date=2026-08-25 (grab real IDs from `/api/services` first)
- http://localhost:4000/api/holidays?businessId=... (grab a businessId from `/api/resources`)

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
│   ├── prisma/schema.prisma   # Business/Resource/Service/Booking models
│   ├── prisma/seed.ts         # sample data
│   ├── src/index.ts           # Express app entrypoint
│   ├── src/routes/health.ts   # GET /api/health
│   ├── src/routes/services.ts # GET /api/services
│   ├── src/routes/slots.ts    # GET /api/slots
│   ├── src/routes/bookings.ts # POST /api/bookings, GET /api/bookings/:bookingRef
│   ├── src/routes/holidays.ts # GET/POST /api/holidays, DELETE /api/holidays/:id
│   ├── src/routes/resources.ts # GET /api/resources, PATCH /api/resources/:id
│   ├── src/services/slotGenerator.ts # pure function: working hours -> candidate slots
│   ├── src/services/availability.ts  # candidates minus bookings minus holidays/closed days
│   └── src/db/prisma.ts       # shared Prisma Client instance
├── postman/booking-system.postman_collection.json # importable API test collection
└── frontend/
    ├── src/App.tsx             # Layout shell + routes (nav bar, <Routes>)
    ├── src/main.tsx            # React entrypoint, wraps App in BrowserRouter
    ├── src/pages/HomePage.tsx  # "/" — health check
    ├── src/pages/ServicesPage.tsx # "/services" — real seeded data from GET /api/services
    ├── src/pages/BookPage.tsx  # "/book" — the booking wizard
    ├── src/pages/FindBookingPage.tsx    # "/find-booking" — manual lookup form
    └── src/pages/BookingDetailsPage.tsx # "/bookings/:bookingRef" — booking details
```

## Next steps
Phase 4: QR code generation, a check-in endpoint, and a staff-facing queue view. Full plan
in the roadmap doc.
