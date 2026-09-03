# Booking System

A full-stack appointment booking and QR check-in system for a clinic, salon, or any business
that books people into time slots — with a customer web app, a staff front desk, an admin
console, and push notifications.

Built as a learning project, phase by phase, with the reasoning for each design decision kept
in the code as comments and in [`CHANGELOG.md`](CHANGELOG.md).

```
Customer books a slot  →  gets a QR code  →  reminder push 6h and 1h before
                                          →  staff scan at the door  →  check-in push
```

---

## Tech stack

### Backend

| | |
| --- | --- |
| **Runtime** | Node.js 18+ |
| **Language** | TypeScript 5 |
| **Framework** | Express 4 |
| **Database** | PostgreSQL 16 |
| **ORM & migrations** | Prisma 5 |
| **Auth** | JSON Web Tokens + bcrypt |
| **Push notifications** | Firebase Cloud Messaging (`firebase-admin`) |
| **Scheduling** | `node-cron` |
| **Uploads** | Multer (local disk; S3 planned) |
| **QR codes** | `qrcode` |
| **Testing** | Vitest + Supertest |

### Frontend

| | |
| --- | --- |
| **Framework** | React 18 |
| **Language** | TypeScript 5 |
| **Build tool** | Vite 5 |
| **UI library** | MUI (Material UI) 5 + Emotion |
| **Routing** | React Router 6 |
| **Testing** | Vitest + React Testing Library |

### Infrastructure

| | |
| --- | --- |
| **Local dev** | Docker Compose (Postgres) |
| **API testing** | Postman collection ([`postman/`](postman/)) |
| **Planned** | AWS — EC2, RDS, S3, SES, Lambda + EventBridge |

---

## Features

- **Slot generation** — open slots computed on demand from working hours minus existing
  bookings, minus holidays, closed weekdays, and times that have already passed. No slot table
  to go stale.
- **Double-booking protection at two levels** — an application check *and* a
  `@@unique([resourceId, startTime])` database constraint. The constraint is the real backstop;
  the application check alone loses a check-then-act race.
- **QR check-in** — generated on demand from the booking reference, never stored.
- **Two separate identity systems** — staff/admin and customers, with a `kind` discriminator
  baked into the JWT so a customer token can never satisfy a staff route, even if a route
  forgets its role check.
- **Push + in-app notifications** — check-in confirmations, configurable reminders (6h and 1h
  by default), and manual staff messages. Stored first, pushed second, so the in-app list is
  complete even when push fails.
- **Cancel & reschedule** — for both customers and staff, sharing one code path so the two
  can't drift.
- **Idempotent booking creation** — an optional client-supplied key makes retries on a flaky
  network safe.
- **Business dashboard** — daily counts by status, expected vs. completed revenue, next up.

---

## Screens

The frontend has 26 screens across three audiences. Auth is enforced twice — a route guard in
React, and the API's own middleware — so a hand-typed URL gets a redirect and a bare `fetch`
gets a 401.

### Public

| Route | Screen | What it does |
| --- | --- | --- |
| `/` | `HomePage` | Landing page — "Book" and "Find my booking" CTAs |
| `/bookings/:bookingRef` | `BookingDetailsPage` | Booking details + QR code (shown while still `BOOKED`) |
| `/staff/login` | `StaffLoginPage` | Staff/admin sign-in |
| `/customer/register` | `CustomerRegisterPage` | Customer self-registration |
| `/customer/verify` | `CustomerVerifyPage` | 6-digit OTP entry — auto-logs-in on success |
| `/customer/login` | `CustomerLoginPage` | Customer sign-in |
| `/customer/forgot-password` | `CustomerForgotPasswordPage` | Request a reset code |
| `/customer/reset-password` | `CustomerResetPasswordPage` | Set a new password with that code |

### Customer — requires a customer login (`RequireCustomerAuth`)

| Route | Screen | What it does |
| --- | --- | --- |
| `/services` | `ServicesPage` | Service list, each row with a "Book" button that pre-selects it |
| `/book` | `BookPage` | Booking wizard — service → date → open slot → confirm. Reads `?serviceId=` |
| `/customer/bookings` | `CustomerBookingsPage` | Own booking history, with cancel and reschedule |
| `/customer/notifications` | `CustomerNotificationsPage` | In-app notification list, mark read |
| `/customer/favorites` | `CustomerFavoritesPage` | Saved services for faster rebooking |
| `/customer/account/profile` | `CustomerProfilePage` | Name, phone, profile picture upload |
| `/customer/account/security` | `CustomerSecurityPage` | Change password |

### Staff — requires a staff login (`RequireAuth`)

| Route | Screen | What it does |
| --- | --- | --- |
| `/dashboard` | `DashboardPage` | Daily KPIs, revenue, completion rate, next 5 bookings |
| `/queue` | `QueuePage` | Who's here / who's next, with inline Check-in / No-show / Complete |
| `/checkin` | `CheckInPage` | Manual booking-reference check-in form |
| `/find-booking` | `FindBookingPage` | Front-desk lookup by booking reference |
| `/staff/bookings/new` | `StaffBookingPage` | Book for an existing customer, or a walk-in with no account |
| `/staff/notifications` | `StaffNotificationsPage` | Send a message to customers; audit of what was sent |

### Admin — requires the `ADMIN` role specifically (`RequireAuth role="ADMIN"`)

| Route | Screen | What it does |
| --- | --- | --- |
| `/admin/resources` | `ResourcesAdminPage` | Add a doctor / stylist / chair |
| `/admin/services` | `ServicesAdminPage` | Add, edit, delete services and prices |
| `/admin/holidays` | `HolidaysAdminPage` | One-off closed dates |
| `/admin/hours` | `HoursAdminPage` | Per-resource working hours and closed weekdays |
| `/admin/notifications` | `NotificationSettingsAdminPage` | Reminder offsets, feature toggles, quiet hours |

Shared components: `NotificationBell` (unread badge, in the app bar) and `RescheduleDialog`
(used by both the customer and staff reschedule flows).

---

## Quick start

**Prerequisites:** Node.js 18+, npm, and Docker (or a local Postgres if you'd rather not use
Docker).

### 1. Start Postgres

```bash
docker compose up -d
```

Postgres on `localhost:5432` — user `booking_user`, password `booking_pass`, database
`booking_db`. These are local development defaults defined in `docker-compose.yml`; they are
not secrets and are not used anywhere else.

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Runs on **http://localhost:4000**. `npm install` also generates the Prisma Client.
`prisma migrate dev` builds the schema in Postgres — re-run it whenever `schema.prisma` changes.

The seed script inserts one sample business, resource, and services, a Friday weekly closure,
one holiday, and two **staff** logins:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@sunriseclinic.test` | `AdminPass123!` |
| Staff | `staff@sunriseclinic.test` | `StaffPass123!` |

> These are sample credentials for a local demo database on a reserved `.test` domain. Anything
> resembling a real deployment needs its own accounts and a real `JWT_SECRET`.

There's no seeded customer — customers self-register at `/customer/register`. OTP delivery is
console-log-only, so **watch the backend terminal for the verification code** after registering.
Push notifications behave the same way: with no `FIREBASE_*` variables set, notifications are
stored and returned by the API and logged to the console instead of being sent, so the whole
flow works with no Firebase project.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on **http://localhost:5173**. If you see "Backend not reachable," the API isn't running.

### 4. Tests

```bash
cd backend && npm test     # 54 cases — Vitest + Supertest
cd frontend && npm test    # 28 cases — Vitest + React Testing Library
```

Backend tests need a **second database** — `booking_db_test`, configured in `backend/.env.test`.
Create it and apply the schema once:

```bash
docker exec -it booking_system_db createdb -U booking_user booking_db_test
cd backend
DATABASE_URL="postgresql://booking_user:booking_pass@localhost:5432/booking_db_test" \
  npx prisma migrate deploy
```

A separate physical database rather than a separate schema, so a bad `TRUNCATE` in test cleanup
can never reach dev data. Re-run `migrate deploy` against it whenever you add a migration.

---

## API overview

All routes are prefixed `/api`. Auth column: **—** public, **C** customer token, **S** staff
token, **A** admin role.

| Group | Endpoints | Auth |
| --- | --- | --- |
| Health | `GET /health` | — |
| Services | `GET /services` · `POST` `PATCH /:id` `DELETE /:id` | — / **A** |
| Slots | `GET /slots?resourceId&serviceId&date` | — |
| Bookings | `POST /bookings` · `GET /bookings/:ref` | **C** / — |
| | `POST /bookings/:ref/cancel` · `PATCH /bookings/:ref/reschedule` | **C** |
| | `POST /bookings/:ref/checkin` `.../no-show` `.../complete` | **S** |
| Resources | `GET /resources` · `POST` `PATCH /:id` | **S** / **A** |
| Holidays | `GET /holidays` · `POST` `DELETE /:id` | **S** / **A** |
| Queue | `GET /queue?resourceId&date` | **S** |
| Dashboard | `GET /dashboard/summary` | **S** |
| Staff auth | `POST /auth/login` · `GET /auth/me` · `POST` `GET /auth/users` | — / **S** / **A** |
| Customer auth | `POST /customer/register` `verify-otp` `resend-otp` `login` `forgot-password` `reset-password` | — |
| | `POST /customer/change-password` · `GET` `PATCH /customer/me` · `POST /customer/me/picture` · `GET /customer/bookings` | **C** |
| Favourites | `GET /favorites` · `POST /favorites` · `DELETE /favorites/:serviceId` | **C** |
| Devices | `POST` `GET` `DELETE /devices` | **C** |
| Notifications | `GET /notifications` · `GET /notifications/unread-count` · `POST /notifications/:id/read` · `POST /notifications/read-all` | **C** |
| Staff bookings | `GET /staff/customers?search=` · `POST /staff/bookings` · `POST` `PATCH /staff/bookings/:ref/...` | **S** |
| Staff notifications | `POST /staff/notifications` · `GET /staff/notifications/sent` · `GET` `PATCH /staff/notifications/settings` | **S** / **A** (patch) |

The [Postman collection](postman/booking-system.postman_collection.json) covers every endpoint,
including requests that demonstrate the double-booking rejection and the idempotent retry.

---

## Architecture notes

A few decisions that shaped the codebase, each explained at length where it lives:

- **No `Slot` table.** Availability is computed on demand in `services/availability.ts` —
  pre-generating rows for recurring daily availability means either stale data or an exploding
  table.
- **One `getAvailableSlots()`.** The slot picker and every booking-creation path run through
  the same function, so the UI and the server-side guard can never disagree about what's open.
- **Two identity systems, deliberately not unified.** `AuthTokenPayload` and
  `CustomerTokenPayload` are distinct TypeScript types, so the compiler itself stops code from
  reading `req.user.role` off a customer token.
- **Snapshotted customer details on `Booking`.** Name and phone are copied at booking time, not
  re-derived from the live `Customer` row — a later profile change shouldn't rewrite history.
  Same reasoning as an e-commerce order's shipping name.
- **Reminders poll rather than schedule.** Detailed in
  [`push-notifications-plan.md`](push-notifications-plan.md) — the short version is that a poll
  re-reads current state each tick, so cancels and reschedules need no timer cleanup and a
  restart loses nothing.

---

## Project layout

```
booking-system/
├── docker-compose.yml          # Postgres for local dev
├── backend/
│   ├── prisma/schema.prisma    # 13 models — Business, Resource, Service, Booking, User,
│   │                           #   Customer, OtpCode, Holiday, FavoriteService, DeviceToken,
│   │                           #   Notification, NotificationDelivery, NotificationSetting
│   ├── prisma/seed.ts          # sample business + staff logins
│   ├── src/app.ts              # Express app — route mounting (importable by tests)
│   ├── src/index.ts            # entrypoint — starts the server and the reminder cron
│   ├── src/routes/             # one router per resource
│   ├── src/services/           # business logic — availability, booking creation & lifecycle,
│   │                           #   auth, OTP, QR, push, notifications, uploads
│   ├── src/middleware/         # requireAuth / requireRole / requireCustomerAuth
│   ├── src/jobs/               # reminderScheduler — the node-cron sweep
│   └── tests/                  # Supertest route tests + helpers
├── frontend/
│   ├── src/theme.ts            # MUI theme — single source of truth for palette & typography
│   ├── src/App.tsx             # layout shell, nav, and every <Route>
│   ├── src/auth/               # two contexts, two guards, two fetch wrappers
│   ├── src/components/         # NotificationBell, RescheduleDialog
│   └── src/pages/              # one file per screen (see Screens above)
└── postman/                    # importable API collection
```

---

## Documentation

| Document | What's in it |
| --- | --- |
| [`CHANGELOG.md`](CHANGELOG.md) | The full phase-by-phase build history |
| [`booking-system-roadmap.md`](booking-system-roadmap.md) | The 7-phase plan |
| [`booking-system-diagrams.md`](booking-system-diagrams.md) | Architecture and flow diagrams |
| [`customer-accounts-plan.md`](customer-accounts-plan.md) | Spec for the customer-accounts feature |
| [`push-notifications-plan.md`](push-notifications-plan.md) | Spec for push & in-app notifications |
| [`mobile-app-plan.md`](mobile-app-plan.md) | Plan for the mobile client |
| [`interview-prep-backend.md`](interview-prep-backend.md) | Design-decision Q&A, backend |
| [`interview-prep-frontend.md`](interview-prep-frontend.md) | Design-decision Q&A, frontend |
| [`SECURITY.md`](SECURITY.md) | What's hardened, what isn't, and how to report a vulnerability |

---

## Roadmap

**Next — Phase 6: AWS deployment.** EC2 for the API, RDS for Postgres, S3 for QR images and
profile pictures (replacing local disk), SES for actually sending OTP emails (replacing
console-log), Lambda + EventBridge for the scheduled no-show sweep and reminder sweep.

Also open: the mobile client, `BOOKING_CONFIRMED` / `BOOKING_CANCELLED` notification triggers
(templates exist, nothing calls them yet), and per-customer notification preferences.

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). This is primarily a personal learning project, but
issues and pull requests are welcome. For anything exploitable, please follow
[`SECURITY.md`](SECURITY.md) and report it privately rather than in a public issue.

## License

[MIT](LICENSE) © Shihab
