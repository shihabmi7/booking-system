# Contributing

This is primarily a personal learning project, so the bar for "is this the right feature" is
whatever I'm trying to learn next. That said, issues and pull requests are genuinely welcome —
particularly bug reports, and corrections where I've reasoned my way to something wrong.

## Getting set up

Follow [Quick start](README.md#quick-start) in the README. The short version:

```bash
docker compose up -d
cd backend  && cp .env.example .env && npm install && npx prisma migrate dev && npm run seed && npm run dev
cd frontend && npm install && npm run dev
```

Nothing external is required to run the full application. OTP emails and push notifications
both fall back to console logging when their providers aren't configured, so every flow works
end to end with just Postgres.

## Before opening a pull request

```bash
cd backend  && npm test && npm run build
cd frontend && npm test && npm run build
```

(There's a `lint` script in both `package.json` files, but ESLint isn't wired up yet — no
dependency and no config. Setting it up is on the list; until then the TypeScript build is
the check that matters.)

Backend tests need the test database to exist and to have the schema applied:

```bash
docker exec -it booking_system_db createdb -U booking_user booking_db_test
cd backend
DATABASE_URL="postgresql://booking_user:booking_pass@localhost:5432/booking_db_test" \
  npx prisma migrate deploy
```

Re-run that `migrate deploy` against `booking_db_test` whenever your change adds a migration —
`prisma migrate dev` only touches the dev database.

## House style

A few conventions the codebase follows fairly consistently. Matching them makes review quick:

- **Comments explain *why*, not *what*.** The code already says what it does. The valuable
  comment is the one recording the alternative that was rejected and the reason — that's what
  stops the next person quietly reintroducing it. Most files here have one at the top.
- **Services hold business logic; routes hold HTTP.** A route validates input, calls a service,
  and maps the result to a status code. If two routes need the same logic, it goes in
  `src/services/` — see `bookingCreation.ts` and `bookingLifecycle.ts`, both shared between the
  customer and staff paths.
- **Result objects over thrown errors** for expected failures. Services return
  `{ ok: true, ... } | { ok: false, error }` so the caller has to handle the failure case.
  Exceptions are for genuinely exceptional things.
- **Let the database enforce what the database can enforce.** Uniqueness, foreign keys, and
  race conditions belong in constraints, not in application-level check-then-act. The
  double-booking guard and the notification `dedupeKey` both work this way.
- **Prisma migrations are checked in.** Change `schema.prisma`, then run
  `npx prisma migrate dev --name a_short_description` and commit the generated SQL.
- **Staff and customer code paths stay separate.** Two auth contexts, two guards, two token
  types. Please don't unify them — the separation is what stops a customer token satisfying a
  staff route.

## Reporting a security issue

See [`SECURITY.md`](SECURITY.md). Please don't open a public issue for anything exploitable.
