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

## Phase 3 — (not started yet)
