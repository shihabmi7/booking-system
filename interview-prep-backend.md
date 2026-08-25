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

## Post-Phase 5 addition — Business dashboard

**Q: `GET /api/dashboard/summary` fetches every matching booking with `findMany()` and sums revenue in a JavaScript `for` loop, instead of asking the database to do the sum (e.g. Prisma's `aggregate`/`groupBy`). Why?**
A: Prisma's `aggregate`/`sum` works on a column of the model you're querying directly — but
the value being summed here (`service.price`) lives on a *related* model (`Service`), not on
`Booking` itself, and Prisma can't sum across a relation in one query. The realistic options
were: a raw SQL query with a `JOIN` (more power, less type safety, and a second query
language to maintain), or fetch the bookings with their related service price included and
reduce them in application code. For a single business's one-day booking volume (dozens to
low hundreds of rows, not millions), summing in JS is simpler, fully type-safe, and fast
enough — the tradeoff would flip if this needed to aggregate across months of data or the
whole platform at once, where pulling every row into memory stops being reasonable.

**Q: Why are `expected` and `completed` revenue reported separately instead of just one "today's revenue" number?**
A: They answer different business questions. "Completed" is revenue actually realized — money
for visits that happened. "Expected" is what today is worth *if every remaining booking goes
as scheduled* — useful for a front-desk or owner checking mid-morning whether the day is on
track, when most bookings haven't happened yet. Collapsing them into one number would either
under-report the day early on (only counting completed) or overstate it by including no-shows
as if they were real revenue. A `NO_SHOW` booking's price is explicitly left out of `expected`
for the same reason — once someone doesn't show up, that revenue isn't "still coming," it's lost.

**Q: The endpoint accepts an optional `?date=` query param but defaults to "today" computed with `new Date().toISOString().slice(0, 10)` on the server. What's the hidden assumption there, and where's it already been made elsewhere in this codebase?**
A: It assumes the server's own clock/timezone is the right definition of "today" for the
business — which silently breaks if the server (e.g. a future EC2 instance in Phase 6) runs in
UTC but the business operates in, say, `Asia/Dhaka` (the seeded business's own `timezone`
field, notably unused here). Near midnight in either direction, "today" on the server and
"today" for the business's actual customers can disagree by a full day. This is the exact same
simplification `GET /api/queue`'s `dayStart`/`dayEnd` computation already made back in Phase 4
— worth naming as a known limitation, and pointing at `Business.timezone` as the field that
already exists in the schema for a more correct version to eventually use.

---

## Customer accounts (backend)

**Q: There's already a `User` model with a `role` field. Why add a whole separate `Customer` model instead of just adding a `CUSTOMER` value to the existing `UserRole` enum?**
A: `User` and `Customer` aren't the same kind of thing wearing a different label — they have
different scopes and different lifecycles. Every `User` belongs to exactly one `businessId`
because staff work for one business; a `Customer` deliberately has no `businessId` at all,
because the same person books at multiple businesses with one account (or would, in a real
multi-tenant version of this product). They also need different fields entirely — a customer
needs `profilePictureUrl` and `emailVerifiedAt`, a staff account never would. Cramming both into
one table means every query has to account for "this column is meaningless for half the rows,"
and — the bigger risk — one shared login table makes it easy to accidentally write an endpoint
that checks `role !== "ADMIN"` and unintentionally lets a customer through, or vice versa. Two
separate tables, two separate JWT shapes, and two separate middlewares make that class of bug
structurally harder to write, not just a matter of remembering a role check everywhere.

**Q: Both staff and customer JWTs get signed and verified — what actually stops a customer's token from being accepted by a staff-only route, given that both are just valid signed JWTs from the same server?**
A: A `kind` discriminator baked into the payload itself, checked at verify time, not just at
authorization time. `signToken()` (staff) always sets `kind: "staff"`, `signCustomerToken()`
always sets `kind: "customer"`, and — this is the important part — `verifyToken()` throws if
`decoded.kind !== "staff"`, and `verifyCustomerToken()` throws symmetrically. So `requireAuth`
(staff) doesn't just fail to find `role: "ADMIN"` on a customer token — it rejects the token
entirely, before any role or ownership check ever runs. This is defense-in-depth: even if a
future developer writes a new staff route and forgets to add `requireRole(...)`, a customer
token still can't get past `requireAuth` in the first place, because the two token *kinds* are
incompatible at the lowest layer, not just conventionally different by role name.

**Q: Why hash the OTP code with bcrypt before storing it, instead of just storing the 6-digit code as plain text — it's not a password, and it expires in 10 minutes anyway?**
A: Anyone who can read the `OtpCode` table (a database dump, a backup, an SQL-injection bug
elsewhere, an overly-broad admin query) shouldn't be able to complete a password reset or email
verification for any pending account just by reading a column. A 6-digit code is a much smaller
search space than a password, but the storage risk is the same category of problem — "what can
an attacker with read access to this table do" — so it gets the same treatment. The 10-minute
expiry limits *how long* a leaked code would even be useful, but it doesn't reduce the value of
hashing it in the first place; a leak in the *first* 9 minutes would still be exploitable if the
code were stored in plain text.

**Q: `verifyOtp` increments an `attempts` counter and rejects after 5 wrong guesses. What attack does that actually stop, and why isn't the 10-minute expiry alone enough?**
A: It stops online brute-forcing — a 6-digit code has only 1,000,000 possibilities, which is
small enough that a script submitting guesses as fast as the API allows could plausibly get
through all of them well within a 10-minute window. Expiry limits the *time* an attacker has;
the attempt limit limits how many *guesses* they get within that time, which is the actual
bottleneck for a small keyspace like 6 digits (versus a password, where the keyspace itself is
usually large enough that time alone is the meaningful constraint). Both protections address
different dimensions of the same brute-force risk, which is why OTP systems generally need both
and passwords usually only lean on the second (rate limiting) rather than a hard attempt cap.

**Q: `createOtp` enforces a 60-second resend cooldown. What's actually being protected — the customer, or the server?**
A: Both, for different reasons. Practically, it stops a customer from mashing "resend code" and
ending up with five codes in flight, confused about which one is still valid (each new
`createOtp` call invalidates the practical usefulness of the previous unconsumed code, since
`verifyOtp` checks against whatever the latest row says). More importantly from a security
angle, it rate-limits how fast an attacker (or a customer's own script) can generate fresh
attempt budgets — without a cooldown, someone could call `resend-otp` in a tight loop, and each
call resets the attempt-counting window, effectively defeating the 5-attempt cap from the
previous question by just requesting a new code before running out of guesses on the old one.

**Q: `Booking.customerId` is nullable. Walk through the two different reasons a booking might have `customerId: null`, and why the schema doesn't need a third field to distinguish them.**
A: One: legacy bookings created before customer accounts existed at all, when `POST /api/bookings`
was fully public and just accepted `customerName`/`customerPhone` in the body — those rows
predate the `Customer` table entirely. Two: a walk-in booking created by staff via
`POST /api/staff/bookings` for someone with no account, where the endpoint accepts
`customerName`/`customerPhone` directly instead of a `customerId`, exactly the same shape as the
old public endpoint used to. Both cases end up with an identical row shape — `customerId: null`,
`customerName`/`customerPhone` populated as a plain snapshot — so there's no need to distinguish
*which* reason a given null came from; the application never needs to ask "was this pre-accounts
or a walk-in," only "does this booking have a linked account or not." That's a case where adding
a distinguishing column would be tracking information the app has no actual use for.

**Q: `createBooking()` got pulled out of the old `POST /api/bookings` handler into `services/bookingCreation.ts` as part of this change. What forced that, and what would have gone wrong without it?**
A: Two entry points needed to create a booking with identical validation, idempotency, and
race-condition handling, but different sources for who the customer is: `POST /api/bookings`
(customer booking themselves — identity comes from `req.customer`, the logged-in token) and the
new `POST /api/staff/bookings` (staff booking for someone else — identity comes from either a
looked-up `Customer` row or raw request-body fields). Without extracting the shared function,
the slot-availability check, the `idempotencyKey` lookup, and the `P2002`-to-409 handling would
all need to be copy-pasted into the second route — and the two copies would inevitably drift
over time as one gets a bug fix or a new check that the other doesn't. Pulling it into one
function with a plain `{resourceId, serviceId, startTime, customerId, customerName, ...}` input
shape means "how a booking gets created" has exactly one definition; the two routes only differ
in *how they populate that input*, which is genuinely where they're supposed to differ.

**Q: `POST /api/customer/register` returns `409 Conflict` with an explicit "email already exists" message — but `forgot-password`, `resend-otp`, and staff `login` all return the same generic message regardless of whether the account exists. Why is registration treated differently?**
A: It's a deliberate, narrow exception to the anti-enumeration principle, not an inconsistency.
The other endpoints protect against enumeration because a generic response costs the legitimate
user nothing — someone who forgot their password doesn't need to know *why* forgot-password
"worked," they just check their email either way. Registration is different: if it silently
"succeeded" for an already-used email, the person would walk away thinking they have a new
account, then be confused later when login fails or a verification email never arrives (because
it went out for the *original* registration, not theirs) — the generic-response version is
actively worse UX with no real attacker upside, since registration pages on virtually every
consumer product already reveal "email taken" and attackers have other, easier ways to check if
an email is registered somewhere (like just trying to register it themselves, which is exactly
what this endpoint would tell them either way). The tradeoff was judged not worth the UX cost here.

**Q: Profile pictures go through `multer` straight to local disk (`backend/uploads/`) rather than something like S3. Given this project's own roadmap already plans an S3 migration for Phase 6, why build the local-disk version at all instead of doing S3 from the start?**
A: Sequencing the *hard problem* separately from the *storage location*. Getting file uploads
working correctly at all — multipart parsing, MIME-type allowlisting, size limits, generating a
non-colliding filename, serving it back out — is the actual learning goal here, and all of that
logic is identical regardless of where the bytes end up. Local disk lets that get built and
tested with zero new infrastructure (no AWS account, no bucket policy, no credentials to wire
into `.env`) and stays fully within the sandboxed dev loop this project has used throughout.
Swapping the storage backend later means changing what's inside `services/upload.ts`'s
`multer.diskStorage` config for an S3-backed multer storage engine (`multer-s3` or similar) and
changing how the URL is constructed — the route handlers in `routes/customer.ts` that call it
don't need to change at all, since they only care about getting back a `profilePictureUrl`
string. Building the S3 version first would have meant learning AWS credentials/IAM/bucket
policy *and* multipart upload handling at the same time, with no way to isolate which one broke
if something went wrong.

**Q: `POST /api/staff/bookings` checks that the target `resourceId` belongs to the caller's own `businessId` before creating anything. Why does that check matter here specifically, given the resource ID has to come from somewhere the staff member already has access to (like their own dashboard)?**
A: Never trust that a request body value is legitimate just because a legitimate client
*usually* sends legitimate values — the check exists for the request that isn't legitimate, not
the normal case. A staff member's JWT proves who they are and what business they work for, but
`resourceId` in the POST body is still just a string the client controls; a malicious or
compromised staff account (or a bug in a future frontend build) could submit a `resourceId`
belonging to a *different* business entirely, and without this check, `createBooking()` would
happily create a booking against someone else's resource — a cross-tenant data-integrity
violation, not just an access-control nicety. It's the exact same ownership-check pattern used
everywhere else in this codebase (holidays, services, resource-hours updates): a role check
(`STAFF`/`ADMIN`) proves *what kind* of user this is, but only an explicit ownership comparison
proves the specific record they're touching is actually theirs to touch.

---

## Post-customer-accounts fix — No booking an elapsed slot

**Q: The fix was one added condition, `slot.startTime > now`, inside `getAvailableSlots()`. Walk through why that single line is enough to also block `POST /api/bookings` and `POST /api/staff/bookings` from creating a past-time booking, given neither of those routes was touched at all.**
A: Because neither of those routes computes availability itself — they both call
`createBooking()` (`services/bookingCreation.ts`), which calls `getAvailableSlots()` to check
"is this specific `startTime` actually one of the currently open slots" before ever calling
`prisma.booking.create()`. Once an elapsed slot stops appearing in that function's returned
list, the `isOpen` check in `bookingCreation.ts` (`availability.slots.some(slot => slot.startTime.getTime() === start.getTime())`)
simply returns `false` for it, and the request gets rejected with the same 409 both paths
already use for "someone else just took this slot." This is the exact payoff of the
single-source-of-truth design already called out in `bookingCreation.ts`'s own comments: fixing
"what counts as available" in one place fixed it for the picker, customer self-service booking,
*and* staff-created bookings simultaneously, instead of needing the same past-time check
copy-pasted into three places (and risking one of them being forgotten).

**Q: Elapsed slots are removed from the `GET /api/slots` response entirely, rather than returned with something like `isPast: true` so the frontend could show them greyed-out for context. What was the reasoning for picking one over the other?**
A: Consistency with how this same function already treats an already-booked slot — those
were never returned-but-flagged either, they're just absent from the list. Introducing a
second visual treatment (grey/disabled) for a *different* reason a slot might be unbookable
(elapsed, vs. already taken) means the frontend now has two different rules for "why can't I
click this," which is more UI complexity for questionable benefit — a customer doesn't
generally need to see "9:00 AM was theoretically available three hours ago" while booking
*right now*. Keeping one rule ("the list only ever contains genuinely bookable slots") keeps
the picker's contract simple: everything shown is clickable, nothing shown needs an
explanation for why it's greyed out.

**Q: The past-time filter has no special-case for "is this today" — it just checks `slot.startTime > now` against every candidate, for every date. Why does that work correctly for a date next week too, without needing an `if (date === today)` branch?**
A: Because `now` (`new Date()`, evaluated once per call) is always chronologically behind every
candidate generated for a future date — a slot at 9:00 AM next Tuesday is never `<= now` today,
so the filter is naturally a no-op for any date that hasn't arrived yet. It only ever actually
removes anything when `date` refers to today (or, if someone requests a past date directly,
removes literally every candidate, correctly returning an empty list). Writing it as a plain
comparison instead of a conditional branch means one code path handles "today, partially
elapsed," "future date, nothing elapsed," and "past date, everything elapsed" correctly without
the three cases ever needing to be reasoned about separately — the comparison just happens to
produce the right answer for all three because of what "now" and "not yet arrived" mean
relative to each other.

**Q: The Postman collection's `date` variable used to be a hardcoded string ("2026-08-25"). Why did this specific change force fixing that, when the collection worked fine with a hardcoded date before?**
A: Before this change, a stale hardcoded date only caused a problem once it landed on the
seeded resource's closed weekday or the seeded one-off holiday — rare, and the collection
would otherwise happily return a full day of "open" slots for a date that had, in reality,
already fully passed, because nothing was checking the date against the actual current time.
That was already slightly wrong (an API returning slots for a day that already happened isn't
meaningful), but it was silently wrong in a way that didn't break any test. Once
`getAvailableSlots()` started checking the clock, that same stale hardcoded date became
guaranteed-in-the-past relative to whenever the collection actually runs, and *every* slot for
it now correctly returns empty — which cascades into every downstream request that assumed
`{{date}}` would yield a bookable slot (create booking, check-in tests, no-show tests, walk-in
tests). The fix — a collection-level pre-request script that recomputes `date` to the next
non-Friday day, every run — makes the test data track "now" the same way the backend now does,
instead of drifting away from reality the moment real time moves past whatever date the
collection happened to be written on.

---

## Phase 6 — (not started yet)
