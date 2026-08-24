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

### Phase 4 — QR check-in ← YOU ARE HERE
- Generate QR code (encodes booking ID) on booking confirmation.
- Check-in endpoint: lookup by booking ID, mark check-in timestamp, flag late/no-show.
- Staff-facing "who's here / who's next" queue endpoint.
- **Interview angle:** state machines (booking status transitions).

### Phase 5 — Auth & roles
- JWT-based auth for staff/admin; customers can act with just their booking ID (no login required for MVP).
- Role-based access (admin vs staff).
- **Interview angle:** authN vs authZ, JWT pitfalls, RBAC.

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
Scaffold the Phase 1 project structure (package.json, tsconfig, Express skeleton, Docker Compose for Postgres) whenever you're ready to start coding.
