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

## Phase 4 — QR check-in

**Q: Why is the QR code generated on every request instead of once and stored?**
A: The QR image is 100% derived from the `bookingRef` — given the same string, `QRCode.toDataURL()`
always produces the same image. Storing it would mean keeping a copy of data that's fully
reconstructable from data already in the database, which is redundant, and worse, it introduces a
staleness risk: if the encoding logic ever changed, every stored QR would need to be regenerated
and re-saved, whereas a derived value just reflects the new logic automatically on the next
request. The tradeoff is CPU cost per request instead of storage — cheap enough here to not matter.

**Q: What's a finite state machine, and why use one for booking status instead of just letting any route `update()` the status field directly?**
A: A finite state machine defines every valid state and exactly which transitions between states
are allowed — everything else is rejected by definition. `services/bookingStateMachine.ts`'s
`ALLOWED_TRANSITIONS` table says `BOOKED` can become `CHECKED_IN`, `NO_SHOW`, or `CANCELLED`, but
`CHECKED_IN` can only become `COMPLETED` — nothing can go "backwards" (e.g. `COMPLETED` back to
`BOOKED`) or skip steps (e.g. `BOOKED` straight to `COMPLETED` without ever checking in). Without
this, any route with database access could set any status, and a bug (or a malicious request) could
put a booking into a nonsensical state, like completing a booking that was never checked in.

**Q: Each state-changing route (`checkin`, `no-show`, `complete`) does its own `findUnique` +
`canTransition` check before updating. Why not just try the update and see if it fails?**
A: Because an invalid transition isn't a database error — `prisma.booking.update()` would happily
change `COMPLETED` to `BOOKED` if asked to, since nothing in the schema itself encodes the state
machine rules (that's an application-level concept, not something a column type or constraint can
express in this case). Checking first means the API can return a clear `409` with a specific reason
("Cannot complete a booking with status BOOKED") instead of either silently corrupting the state or
crashing.

**Q: What does the `isLate` flag mean, and why is it computed rather than stored?**
A: `isLate` compares "now" against the booking's `startTime` plus a grace period — it's true if a
still-`BOOKED` appointment's time has passed by more than 10 minutes with no check-in. It has to be
computed at request time, not stored, because its value changes purely with the passage of time —
no event happens at the exact moment a booking "becomes late," so there's nothing to trigger writing
it to the database. This is different from `checkedInAt`, which is set once, at a specific real event.

**Q: The no-show endpoint requires a staff member to manually mark it — why not have the system automatically mark bookings as no-show once they're late?**
A: That's intentional, and deferred to Phase 6, not skipped. Automatically flagging something as
*late* (informational) is very different from automatically changing its *status* to a terminal
state like `NO_SHOW` (consequential) — a customer might arrive 12 minutes late and still be seen. A
scheduled background sweep (Lambda + EventBridge in Phase 6) is a reasonable way to auto-mark
no-shows after a longer, clearly-defined cutoff, but that's a deliberate policy decision for later,
not something to bake into the check-in endpoint itself.

---

## Phase 5 — Auth & roles (backend)

**Q: What's the difference between authentication and authorization, and where does each show up in this project?**
A: Authentication (authN) answers "who are you?" — proving identity, done here by
`POST /api/auth/login` checking an email/password pair and issuing a JWT. Authorization (authZ)
answers "are you allowed to do this?" — done here in two layers: `requireRole(...roles)` (does
this role, e.g. STAFF, get to call this endpoint at all?) and the explicit ownership checks inside
each handler (does this specific record belong to this user's own business?). It's a common mistake
to stop at role checks and assume that's "authorization" — role checks alone would let an ADMIN of
Business A edit Business B's holidays, since both are just "an ADMIN." The ownership check is what
actually closes that gap.

**Q: Why is the JWT stored in `localStorage` on the frontend instead of an httpOnly cookie?**
A: It's a tradeoff between two attack surfaces, not a free choice. `localStorage` is readable by
any JavaScript running on the page, so it's vulnerable to XSS — if an attacker can inject a script,
they can steal the token. An httpOnly cookie can't be read by JavaScript at all, closing that hole,
but cookies are automatically attached to every request to that domain, which opens up CSRF unless
you add CSRF tokens/SameSite protections. This project picked `localStorage` because it's simpler
to wire up for a monolith with a separate-origin dev frontend (no cookie domain/SameSite
configuration to get right), and there's no untrusted third-party script surface yet. It's a
reasonable MVP choice, explicitly not the only correct answer — worth naming the tradeoff if asked
rather than presenting it as risk-free.

**Q: Where is the JWT itself stored — is there a "sessions" table in the database?**
A: No. A JWT is stateless — the token itself contains the payload (`userId`, `role`, `businessId`)
plus a cryptographic signature, and the server verifies it just by checking the signature against
`JWT_SECRET`, with no database lookup required per request. Nothing about the token is stored
anywhere after it's issued; the server doesn't "remember" who it gave tokens to. What is stored in
the database is the `User` row itself (email, `passwordHash`, role) — that's checked once, at
login time, to decide whether to issue a token in the first place.

**Q: What's the tradeoff of JWTs being stateless — specifically, how would you revoke one before it expires?**
A: The stateless property that makes JWTs fast (no DB lookup per request) is exactly what makes
them hard to revoke — there's no server-side record to delete. The token stays valid until it
expires (`JWT_EXPIRES_IN=8h` here) no matter what happens afterward, even if the user's account is
disabled. Real revocation requires reintroducing state: a denylist of revoked token IDs checked on
every request (which brings back the per-request lookup you were trying to avoid), or a
`tokenVersion` column on the `User` row that's included in the JWT payload and bumped on logout/
password change, invalidating every previously-issued token for that user at once. Neither is
implemented here — a known, acceptable gap for an 8-hour-expiry MVP, worth naming as a limitation.

**Q: How does `bcrypt` protect a password, and why not just store it hashed with something like SHA-256?**
A: `bcrypt.hash()` combines the password with a random salt (preventing two identical passwords
from producing the same hash, which would otherwise let an attacker spot them via a precomputed
rainbow table) and deliberately runs slowly — the "cost factor" (10 here) controls how many rounds
of internal hashing happen, making each guess expensive. A general-purpose hash like SHA-256 is
built to be *fast*, which is exactly the wrong property for passwords — it makes brute-forcing
billions of guesses per second on modern hardware feasible. `bcrypt` (and similar: `scrypt`,
`argon2`) are designed specifically to be slow and tunable, so an attacker who steals the database
still faces years of compute to crack even weak passwords at scale.

**Q: `POST /api/auth/login` returns the same error whether the email doesn't exist or the password is wrong. Why not tell the user which one failed?**
A: To prevent user enumeration. If "email not found" and "wrong password" returned different
errors, an attacker could feed in a list of email addresses and learn which ones have accounts on
the system — useful information for a targeted phishing or credential-stuffing attack, even without
ever guessing a password. Returning a single generic "invalid email or password" message for both
cases means a failed login reveals nothing about whether the email exists at all.

**Q: Why is there no public "sign up" endpoint for creating accounts?**
A: Because every `User` here is a staff or admin login for the business running the system — not a
customer account. Customers never authenticate at all (they prove ownership of a booking with its
`bookingRef`, as established back in Phase 1/3). Letting anyone hit a public endpoint and grant
themselves a STAFF or ADMIN role would defeat the entire point of role-based access control. New
staff accounts are created one of two ways: the seed script bootstraps the very first admin/staff
pair (solving the chicken-and-egg problem of "how do you create the first admin with no admin yet
logged in"), and after that, `POST /api/auth/users` requires an existing ADMIN's token — so account
creation is itself gated behind the same auth system it's creating accounts for.

**Q: Walk through what happens, step by step, when a request hits `POST /api/holidays` with a valid ADMIN token.**
A: Express matches the route and runs its middleware chain in order: first `requireAuth`, which
reads the `Authorization: Bearer <token>` header, calls `verifyToken()` (this checks the JWT
signature against `JWT_SECRET` and that it hasn't expired), and on success attaches the decoded
payload to `req.user` before calling `next()`. Then `requireRole(UserRole.ADMIN)` runs, checking
`req.user.role === "ADMIN"` — if not, it responds `403` and the chain stops there. If it passes,
the actual route handler runs, and inside it uses `req.user.businessId` (not anything from the
request body) to scope the new holiday to the logged-in admin's own business — the client can't
spoof which business a holiday belongs to by passing a different `businessId` in the JSON body,
because the handler ignores that field entirely and trusts only the token's payload.

**Q: How does TypeScript know that `req.user` exists on Express's `Request` type, when the base `Request` type has no such property?**
A: Through declaration merging — `src/types/express.d.ts` declares `namespace Express { interface
Request { user?: AuthTokenPayload } }` inside a `declare global` block. TypeScript interfaces are
"open": declaring the same interface name again doesn't overwrite the original, it merges the new
members into it. Since `express`'s own types define `Request` inside the `Express` namespace,
re-declaring that same namespace/interface anywhere in the project's compiled scope adds `user` as
an optional property everywhere `Request` is used, without editing `express`'s own type
definitions. It's marked optional (`user?`) because it's only set after `requireAuth` runs — routes
without that middleware genuinely don't have it, which is also why route handlers use `req.user!`
(a non-null assertion) only *after* `requireAuth` has already guaranteed it's set.

---

## Post-Phase 5 addition — Service management endpoints

**Q: `Service` doesn't have its own `businessId` column, unlike `Holiday` or `Resource`. How do you check ownership for `POST /api/services` without one?**
A: Go through the relation instead of a direct column. The request body includes a
`resourceId`, so the handler fetches that `Resource` first and compares *its* `businessId`
against `req.user.businessId` — if they don't match, `403`, before any service ever gets
created. It's the same ownership principle as everywhere else in the app (a role check alone
isn't authorization, the record has to actually belong to the caller), just applied one hop
away because the schema doesn't duplicate `businessId` onto every table that's transitively
scoped to a business through a parent relation.

**Q: Why does `DELETE /api/services/:id` catch a specific Prisma error code (`P2003`) instead of just letting the delete happen?**
A: `Service` has a `bookings Booking[]` relation — if any booking still references that
service, the database's foreign key constraint blocks the delete outright rather than leaving
a `Booking` row pointing at a service that no longer exists (an orphaned/dangling reference,
which would corrupt data integrity). Prisma surfaces that as error code `P2003` (foreign key
constraint violation). Without catching it, the client would just see a raw `500`, which looks
like a server bug rather than what it actually is: "you can't delete this, something depends
on it." Catching `P2003` and returning a `409 Conflict` with a clear message turns an expected,
recoverable situation into a proper API response instead of an unhandled crash — the same
pattern already used for `P2002` (unique constraint) elsewhere in `bookings.ts`/`holidays.ts`.

**Q: The `signToken` function needed a type cast (`as jwt.SignOptions["expiresIn"]`) once `@types/jsonwebtoken` was actually installed, even though the code "worked" before. What does that reveal about relying on `npm install` output alone?**
A: Before the real install, `bcryptjs`/`jsonwebtoken` were missing entirely, so TypeScript
couldn't check `signToken`'s body at all — it just reported "module not found" and stopped
there, which *hides* any deeper type errors inside code that imports a missing module. Once
the real package (and its `@types` definitions) were installed, TypeScript could finally
type-check the actual call, and found that `expiresIn` expects a narrow template-literal type
(`"8h"`, `"30m"`, specific formats only), not a plain `string` — which is what reading
`process.env.JWT_EXPIRES_IN` produces. The lesson: "no errors" from `tsc` isn't meaningful if
a missing dependency is silently short-circuiting the check for everything that imports it —
always re-run the type checker after a fresh `npm install`, not just after writing new code.

---

## Post-Phase 5 addition — Resource creation

**Q: `POST /api/resources` accepts `workingHoursStart`, `workingHoursEnd`, and `closedWeekdays` as optional, and falls back to `undefined` (not a literal value) when they're missing. Why does that specific fallback matter?**
A: `Resource.workingHoursStart` in `schema.prisma` has `@default("09:00")` — a default defined
once, at the database/schema level. Passing `workingHoursStart: undefined` to
`prisma.resource.create()` tells Prisma "no value provided for this field," which lets that
`@default` kick in. Passing `workingHoursStart: null` or an empty string instead would be an
*explicit* value overriding the default — and since the column isn't nullable, `null` would
actually throw a database error. The fallback pattern `workingHoursStart || undefined` matters
because it's the difference between "let the schema's single source of truth decide" and
"silently write a wrong value" — this is a general Prisma/SQL `DEFAULT` gotcha, not specific to
this field.

**Q: Why does creating a resource live on its own tab (`/admin/resources`) instead of just being a "new resource" row at the top of the Hours tab, which already lists every resource?**
A: They're different operations with different backend endpoints (`POST` vs `PATCH`) and
different concerns — creating asks "what's this resource called," editing asks "what are this
resource's hours." Merging them into one screen would mean one form doing double duty:
sometimes creating with mostly-default values, sometimes updating an existing row's hours,
with the UI having to guess which mode it's in. Keeping them separate mirrors the backend split
exactly, and each page stays simpler for it — the same reasoning used earlier for why
`ServicesAdminPage`'s add-form and edit-row are visually different (inline edit vs a form) even
though they're on the same page there, just at a coarser grain here (separate tabs instead of
separate UI within one tab).

---

## Phase 6 — (not started yet)
