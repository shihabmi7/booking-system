# Backend / Node.js / TypeScript — Interview Prep Notes

Running log of Q&A this project has actually touched, updated as we complete each phase.
Each answer ties back to real code in `backend/`, not abstract theory.

---

## Phase 1 — Project setup

**Q: What happens if you register auth middleware after your routes in Express?**
A: Nothing — it never runs for those routes. `app.use()` calls execute in registration order, for every
matching request, before the route handler fires. If middleware is registered after a route, that route's
handler already ran and responded before the middleware ever gets a chance. This project's `index.ts`
registers `cors()` and `express.json()` before mounting any routers, specifically so every request passes
through them first.

**Q: How would you structure routes in a large Express app?**
A: Use `Router()` to create sub-applications per resource (e.g. a router for bookings, one for users, one
for health checks), then mount each at a path prefix with `app.use("/api/bookings", bookingsRouter)`.
Keeps route files small and organized by domain instead of one giant file with every endpoint.

**Q: Why use a connection pool instead of a single database connection?**
A: A single connection can only handle one query at a time — every concurrent request would queue up
behind it. A pool (`pg.Pool`) keeps several connections open and hands one out per query, so multiple
requests can hit the database simultaneously. Opening/closing a fresh connection per request is also
expensive (TCP handshake, auth) — pooling reuses connections instead.

**Q: What does `strict: true` actually do in TypeScript?**
A: It's a shortcut that enables a whole set of stricter checks at once — `noImplicitAny` (no silent `any`
types), `strictNullChecks` (null/undefined must be handled explicitly), and others. Without `strict`,
TypeScript is much closer to plain JavaScript with optional type annotations; `strict` is what makes it
actually catch real bugs at compile time.

**Q: What's the difference between CommonJS and ESM, and how does TypeScript handle both?**
A: CommonJS uses `require()`/`module.exports` and resolves modules synchronously — it's Node's original
module system. ESM uses `import`/`export`, resolves differently, and is the JS standard going forward.
TypeScript's `module` and `moduleResolution` settings need to match which system you're targeting. This
project uses `"module": "node16"` + `"moduleResolution": "node16"`, which mirrors Node's real resolution
algorithm and understands both — the older `"node"` (aka `node10`) setting is deprecated as of TS 5.x/6.0
and doesn't reflect how modern Node actually resolves modules.

**Q: What's the difference between `^`, `~`, and an exact version in `package.json`?**
A: An exact version (`4.19.2`) installs only that version. `~4.19.2` allows patch updates only (`4.19.x`).
`^4.19.2` allows minor and patch updates (`4.x.x`, so up to but not including `5.0.0`) — this is npm's
default and what this project's dependencies use. `^` is the most common because it accepts backwards-compatible
updates automatically while blocking breaking major-version bumps.

**Q: Why would a package be a devDependency instead of a dependency?**
A: `dependencies` are required at runtime — the app won't run without them (express, pg, cors, dotenv).
`devDependencies` are only needed while developing or building (typescript, ts-node-dev, @types/*) — once
`tsc` compiles TypeScript to plain JavaScript, none of that tooling is needed to actually run `dist/index.js`.
Keeping the split accurate matters for production installs (`npm install --production` skips devDependencies).

---

## Phase 2 — Core domain & schema

**Q: What does an ORM like Prisma give you over writing raw SQL?**
A: Type-safe queries generated from your schema (autocomplete + compile-time errors if a field doesn't
exist), migration management (tracked, versioned schema changes instead of manually-run `.sql` files),
and relation handling (e.g. `prisma.service.findMany({ include: { resource: true } })` instead of hand-writing
JOINs). The tradeoff is less direct control over the exact SQL generated, and another abstraction layer to learn.

**Q: What's the difference between `prisma migrate dev` and `prisma generate`?**
A: `migrate dev` compares your `schema.prisma` against the database, creates a new SQL migration file for
the difference, and applies it — it changes the actual database structure. `generate` regenerates the
Prisma Client (the type-safe query API) based on the current schema — it doesn't touch the database at
all, just the generated TypeScript code you import. `migrate dev` runs `generate` automatically afterward.

**Q: Why did this project choose not to store a Slot as its own database table?**
A: Slots are a derived concept — "9:00, 9:20, 9:40..." for a given day is just the Resource's working
hours sliced by service duration, minus whatever's already booked. Storing every possible slot as a row
would mean generating and maintaining potentially thousands of rows per resource per day, most of which
are never touched, and keeping them in sync with working-hours changes. Computing availability on demand
from `workingHoursStart`/`workingHoursEnd` and existing `Booking` rows avoids that entirely — the tradeoff
is slightly more computation per request instead of a simple table read.

**Q: Why put `checkedInAt` and `checkInMethod` directly on the Booking table instead of a separate CheckIn table?**
A: It's a one-to-one relationship — every check-in belongs to exactly one booking, and a booking has at
most one check-in. A separate table only pays off when the relationship is one-to-many (e.g. if a booking
could be checked in multiple times, or you needed a full audit history of check-in attempts) or when the
extra fields are rarely queried together with the parent. Here, a normal booking-detail query almost
always wants to know check-in status too, so keeping it on the same row avoids an unnecessary join.

**Q: What's a UUID primary key vs an auto-incrementing integer, and why might you pick one over the other?**
A: An integer ID (1, 2, 3...) is smaller and slightly faster to index, but reveals how many rows exist and
is guaranteed collision-free only within one database — problematic if you ever shard or merge data across
systems. A UUID (`bookingRef` here) is generated independently of the database, so it can be created
client-side or across distributed systems without coordination, and it doesn't leak row counts. This
project uses UUIDs for `id` and a separate UUID `bookingRef` specifically so the public-facing booking
reference (used in the QR code) never overlaps with or reveals anything about the internal primary key.

---

## Phase 3 — Booking API

**Q: What's a "check-then-act" race condition, and where does this project have one?**
A: It's when code checks a condition, then acts on it, but something else can change that
condition in between — the check is no longer true by the time you act on it. `POST /api/bookings`
checks whether a slot is available (`getAvailableSlots`), then creates the booking as a separate
step. If two requests for the same slot both pass the check at nearly the same instant, both would
try to create the booking — the check alone can't prevent that, because there's a gap between
"checked" and "acted."

**Q: If the availability check can't prevent the race condition, why keep it at all?**
A: It's for the error message, not correctness. Without it, a double-booking attempt would fail
with a raw database constraint error, which is confusing to the end user and leaks internal
details. The application-level check gives a clean "that slot isn't available" response for the
common case (checking a stale slot list), while the database constraint is what actually
guarantees correctness for the rare concurrent-request case.

**Q: How does a unique constraint actually prevent two simultaneous requests from both succeeding?**
A: The database itself enforces it at the storage layer — when two `INSERT`s for the same
`(resourceId, startTime)` pair happen concurrently, the database serializes them (one has to
happen before the other, even if they arrived "at the same time" from the app's perspective).
Whichever one commits first succeeds; the second gets a unique-constraint-violation error, because
the database won't allow the duplicate row to exist. This project's `@@unique([resourceId, startTime])`
in `schema.prisma` is what creates that constraint; the `catch` block in `bookings.ts` checks for
Prisma's `P2002` error code and turns it into a `409 Conflict` instead of letting it surface as a
raw 500 error.

**Q: What is idempotency, and how is it implemented here?**
A: An idempotent operation produces the same result no matter how many times it's repeated —
useful for retries after a timeout or flaky connection, where the client can't tell if the first
request actually succeeded. `POST /api/bookings` accepts an optional `idempotencyKey`; if a booking
already exists with that key, the endpoint returns the existing booking instead of creating a new
one. The key is only useful if the client generates and reuses the *same* key across retries of the
*same* logical request — a new key each time defeats the purpose.

**Q: Why does the slot-generation logic live in a separate pure function (`generateSlotCandidates`)
instead of directly inside the route handler?**
A: It has no dependencies on Express, Prisma, or the database — just plain input (working hours,
duration, date) to plain output (a list of time ranges). That makes it trivial to unit test in
isolation (no test database or mock HTTP request needed) and reusable — both `GET /api/slots` and
the availability check inside `POST /api/bookings` call the same underlying logic through
`services/availability.ts`, so there's one definition of "available" instead of two that could drift.

**Q: How do you check if two time ranges overlap?**
A: `rangeA.start < rangeB.end && rangeB.start < rangeA.end`. It's easier to reason about the
non-overlap case first — two ranges don't overlap if one ends before the other starts, in either
direction (`a.end <= b.start || b.end <= a.start`) — then negate it. This project's
`services/availability.ts` uses exactly this check to filter out any candidate slot that overlaps
an existing booking.

---

## Post-Phase 3 addition — Holidays & working hours

**Q: Why are recurring weekly closures (`closedWeekdays`) and one-off holidays (`Holiday`) modeled
as two separate things instead of one?**
A: They have different shapes and different owners. A weekly closure is a fixed, recurring rule
about one specific resource (e.g. "Dr. Rahman never works Fridays") — it doesn't need a row per
week, just an array of weekday numbers on the `Resource` itself. A holiday is a specific one-off
date that typically applies to the *whole business* at once (a public holiday, a planned shutdown)
— that needs its own table so you can add/remove individual dates without touching every resource.
Modeling them as one generic "closure" concept would force awkward choices, like whether a weekly
rule needs its own row for every future Friday.

**Q: Why does `Holiday` belong to `Business` instead of `Resource`?**
A: Because in the common case, a holiday affects everyone — if the clinic is closed for a public
holiday, every resource in it is closed too. Attaching holidays to the business lets you declare
that once. The tradeoff: this schema can't currently express "only Dr. Rahman is off on this one
date, but the rest of the clinic is open" — that would need a resource-specific holiday concept,
deliberately left out here since it wasn't a requirement yet. Worth naming as a known limitation if asked.

**Q: Why does `getAvailableSlots` check `closedWeekdays` before querying the `Holiday` table, instead of the other way around?**
A: Cheapest check first. `closedWeekdays` is already sitting on the `resource` object that was
just fetched — checking it costs nothing extra. The holiday check requires an additional database
query. If the weekday check already proves the day is closed, there's no reason to spend a query
confirming something that no longer matters — the function returns early either way.

**Q: The `Holiday.date` field uses `@db.Date` instead of a plain `DateTime`. What's the difference, and why does it matter here?**
A: A regular `DateTime` in Postgres stores a specific instant, including a time component (and
often a timezone) — `2026-08-29T00:00:00Z` is a different value than `2026-08-29T05:00:00Z` even
though a human would call both "August 29th." `@db.Date` stores only the calendar date, with no
time component at all, so `findUnique` with a compound key like `businessId_date` matches reliably
regardless of what time of day the record was created — exactly what you want for "is this
calendar date a holiday," where the time component is meaningless.

**Q: `GET /api/slots` changed from returning a bare array to an object (`{ slots, note }`). Why is that not considered a breaking change to just avoid?**
A: It technically is a breaking change to the response shape — any existing client code doing
`response.map(...)` directly would break. It was made anyway because the alternative (returning an
empty array with zero explanation for *why* there's nothing available) is a worse API: a customer
sees "no slots" and has no idea whether that's a fully-booked day, a holiday, or a bug. Breaking
changes are sometimes the right call during active development, before an API has real external
consumers depending on the old shape — this is exactly the kind of change that would need a
versioned endpoint (`/v2/slots`) or a deprecation period once the API is actually public.

**Q: Seed scripts often use `create`, but this project's seed now checks for existing data first. Why does that matter in practice?**
A: `prisma.business.create()` always inserts a new row — it has no idea whether one already
exists. Running `npm run seed` more than once (easy to do without noticing, e.g. re-running it
after every migration out of habit) silently created a second "Sunrise Family Clinic" with its
own resource and services each time, which showed up as duplicate rows on the `/services` page.
The fix is a `findFirst` check before the `create`, so re-running the script is a safe no-op
instead of a data-duplication bug. This is the same idea as the `idempotencyKey` on bookings,
just applied to a setup script instead of an API endpoint.

---

## Phase 4 — (not started yet)
