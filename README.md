# Booking System

Backend (Express + TypeScript + Postgres) and frontend (React + TypeScript via Vite),
wired together with a health-check call so you can confirm both apps and the database talk to each other.

See `booking-system-roadmap.md` (in this folder) for the full 7-phase plan.

## Current status: Phase 1 ✅ done. Phase 2 ✅ done. Starting Phase 3.

### What's done so far
- **Phase 1:** Backend (Express+TS) and frontend (React+TS/Vite) scaffolded and wired end-to-end
  through Postgres — `/api/health` confirms `dbConnected: true`.
- **Phase 2 (backend):** Prisma added as ORM + migration tool (replaced raw `pg`). Schema defines
  Business/Resource/Service/Booking models. Seed script adds sample data. New `GET /api/services`
  endpoint proves schema+migration+seed work together. Health check now uses `prisma.$queryRaw`.
- **Phase 2 (frontend):** React Router added. `App.tsx` is now a layout shell with a nav bar;
  `/` shows the health check, `/services` fetches and renders the real seeded services in a table.
- Troubleshooting resolved along the way: fixed a wrong-directory `npm install`, a port-5432 conflict
  with an existing Postgres container, created `booking_user`/`booking_db` inside that container,
  and granted `booking_user` `CREATEDB` so Prisma's shadow database could be created.

### What's next — Phase 3: Booking API
- Endpoints: list available slots, create booking, get booking by ID.
- Slot generation logic (computed from working hours minus existing bookings).
- Handle double-booking with DB transactions/row locking; idempotent booking creation.

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
npx prisma migrate dev --name init_schema
npm run seed
npm run dev
```
`npm install` also generates the Prisma Client automatically. `prisma migrate dev` creates the actual
tables in Postgres from `schema.prisma` (only needs to be re-run when the schema changes). `npm run seed`
inserts one sample business/resource/services.

Backend runs on http://localhost:4000. Check it directly:
- http://localhost:4000/api/health
- http://localhost:4000/api/services

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
│   └── src/db/prisma.ts       # shared Prisma Client instance
└── frontend/
    ├── src/App.tsx             # Layout shell + routes (nav bar, <Routes>)
    ├── src/main.tsx            # React entrypoint, wraps App in BrowserRouter
    ├── src/pages/HomePage.tsx  # "/" — health check
    └── src/pages/ServicesPage.tsx # "/services" — real seeded data from GET /api/services
```

## Next steps
Phase 3: real booking API (list slots, create booking, get booking by ID), slot generation
logic, and concurrency-safe booking creation. Full plan in the roadmap doc.
