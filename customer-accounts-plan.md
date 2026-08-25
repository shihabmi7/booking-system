# Customer Accounts & Authentication — Plan

Status: **✅ done** (backend + frontend, all 13 rollout steps complete). Slotted in as
**Phase 5.5** — between Phase 5 (staff auth) and Phase 6 (AWS deployment) — so existing phase
numbers didn't need to change. See `README.md`'s "What's done so far" for the summary, and
`interview-prep-backend.md`/`interview-prep-frontend.md` for the design-decision Q&A this
feature added. Remaining local setup before it runs: `npx prisma migrate dev` and `npm install`
in `backend/` (adds `Customer`/`OtpCode` tables and the `multer` dependency) — not yet run in
this sandboxed dev environment.

## What's changing, in one paragraph

Today, customers book with zero login (Phase 1's original design: "prove ownership of a
booking just by knowing its `bookingRef`"). This plan replaces that with real customer
accounts: email + password login, email verified via a 6-digit OTP, forgot/change password,
an editable profile (name, phone, profile picture — **not** email, which stays the fixed
identifier), and a booking history page. Booking creation moves from public to
customer-authenticated (for the customer's own self-service flow) — but staff can also create
a booking directly for a walk-in, so the front desk isn't blocked by "the customer forgot their
password." Customer auth gets its own URL space, fully separate from staff, which moves to
`/staff/login`.

## Decisions locked in

- **Staff login URL** moves from `/login` to `/staff/login` — full symmetry with
  `/customer/login`, everything under `/staff/*` or `/customer/*`.
- **OTP delivery**: console-log only for now (`console.log` on the backend). No real email
  provider until Phase 6's SES work; this keeps the whole flow testable today without any
  email setup.
- **Profile pictures**: local disk via `multer`, served statically from the backend, migrated
  to S3 in Phase 6.
- **Staff can create bookings** for walk-in customers, not just customers themselves — see
  "Staff-created bookings" below for the design.

## Data model

Two new tables, one modified column.

```prisma
model Customer {
  id                String    @id @default(uuid())
  email             String    @unique
  passwordHash      String
  name              String
  phone             String?
  profilePictureUrl String?
  // null = not verified yet. Login and booking creation both require this to be set —
  // see "Where email verification is enforced" below.
  emailVerifiedAt   DateTime?
  createdAt         DateTime  @default(now())
  bookings          Booking[]
  otpCodes          OtpCode[]
}

enum OtpPurpose {
  EMAIL_VERIFY
  PASSWORD_RESET
}

model OtpCode {
  id         String     @id @default(uuid())
  customerId String
  customer   Customer   @relation(fields: [customerId], references: [id])
  purpose    OtpPurpose
  // Hashed with bcrypt, same as a password — never store the raw 6-digit code. Low entropy
  // (only 1,000,000 possibilities) is compensated by expiresAt + attempts below, not by the
  // hash alone, but there's no reason to store it in plaintext either.
  codeHash   String
  expiresAt  DateTime
  consumedAt DateTime?
  attempts   Int        @default(0)
  createdAt  DateTime   @default(now())
}
```

`Booking` gains a nullable `customerId`:

```prisma
model Booking {
  // ...existing fields unchanged...
  customerId String?
  customer   Customer? @relation(fields: [customerId], references: [id])
}
```

Nullable, not required. This does double duty: it's a legacy-data escape hatch for existing
seeded/test bookings (no real customer to backfill them with), **and** an ongoing valid state
for staff-created walk-in bookings that don't reference any customer account at all (see
"Staff-created bookings" below) — not a one-time migration shim that gets phased out later.

`customerName`/`customerPhone`/`customerEmail` stay on `Booking` as they are today, but change
from "typed by whoever's booking" to "snapshotted from the customer's profile at booking time."
That's deliberate: if a customer later renames their profile, a booking made under their old
name should still show the old name — the same reasoning e-commerce order histories use for
shipping names/addresses.

## AuthN/AuthZ design

Staff and customers are **two separate identity systems that happen to share infrastructure**
(JWT, bcrypt), not one unified "user" concept. Concretely:

- Staff JWT payload becomes `{ kind: "staff", userId, role, businessId }` (adds a `kind` field
  to what exists today).
- Customer JWT payload: `{ kind: "customer", customerId, email }`.
- `middleware/auth.ts`'s `requireAuth` explicitly checks `payload.kind === "staff"`; a new
  `middleware/customerAuth.ts`'s `requireCustomerAuth` checks `payload.kind === "customer"`.
  This means a stolen/reused customer token literally cannot satisfy a staff-only route and
  vice versa, even if someone forgot a role check somewhere — defense in depth, not just
  "different routes happen to check different things."
- Separate secrets are unnecessary (same `JWT_SECRET` is fine) since the `kind` check is what
  actually enforces the boundary.

### Where email verification is enforced

- `POST /api/customer/login` rejects with a specific error if `emailVerifiedAt` is null
  (distinct from "wrong password," so the frontend can show "please verify your email, resend
  code?" instead of a generic failure).
- `POST /api/bookings` (customer-facing create) requires a valid customer JWT — which, given
  the login gate above, means only verified customers can ever hold one.

## New backend endpoints

All under `/api/customer/*` — separate namespace from staff's `/api/auth/*`.

```
POST   /api/customer/register        {email, password, name, phone?}  -> creates unverified account, sends OTP
POST   /api/customer/verify-otp      {email, code}                    -> verifies, auto-logs-in (returns JWT)
POST   /api/customer/resend-otp      {email}                          -> new OTP, rate-limited
POST   /api/customer/login           {email, password}                -> JWT (requires verified email)
POST   /api/customer/forgot-password {email}                          -> sends OTP (purpose PASSWORD_RESET)
POST   /api/customer/reset-password  {email, code, newPassword}       -> verifies OTP, sets new password
POST   /api/customer/change-password {currentPassword, newPassword}   -> requireCustomerAuth
GET    /api/customer/me                                               -> requireCustomerAuth
PATCH  /api/customer/me              {name?, phone?}                  -> requireCustomerAuth
POST   /api/customer/me/picture      (multipart upload)                -> requireCustomerAuth
GET    /api/customer/bookings                                          -> requireCustomerAuth, own bookings only
```

`POST /api/bookings` changes from public to `requireCustomerAuth`; `customerId` and the
name/phone/email snapshot come from the authenticated customer's profile, not the request
body. `GET /api/bookings/:bookingRef` (the reference lookup used by staff check-in/QR) **stays
public** — that flow doesn't involve the customer being logged in on the staff's device.

Forgot-password follows the same "don't reveal whether an email exists" principle already used
for staff login: same generic response whether the email is registered or not.

## Staff-created bookings

Front desk shouldn't be blocked from booking a walk-in just because the customer doesn't have
(or can't log into) an account. Two new staff-only endpoints, separate from the customer
self-service ones above:

```
GET  /api/staff/customers?search=...   -> requireAuth + requireRole(STAFF, ADMIN)
                                           looks up existing customers by name/email/phone
POST /api/staff/bookings               -> requireAuth + requireRole(STAFF, ADMIN)
                                           body: EITHER { customerId, ...slot fields }
                                                 OR     { customerName, customerPhone, ...slot fields }
```

Staff search for an existing customer first (`GET /api/staff/customers?search=`); if found,
the booking gets a real `customerId` and that customer will see it in their own booking
history. If not found — the common walk-in case — staff just type a name and phone, and the
booking is created with `customerId: null`, exactly like every booking worked before this
phase existed. No half-account, no password, no OTP gets created for a walk-in; it only
becomes a full account if that person later signs up themselves with the same email, at which
point... **note:** this plan does *not* retroactively link old walk-in bookings to a new
account by matching email/phone — that's a reasonable future enhancement, explicitly out of
scope here to keep this addition bounded.

Frontend: a new `StaffBookingPage.tsx` at `/staff/bookings/new` — same wizard shape as the
customer-facing `BookPage`, plus a customer-search step at the top (search existing / or a
"walk-in, no account" toggle that reveals plain name+phone fields instead). Linked from the
Queue page and the Dashboard's quick actions.

## Frontend

Two fully separate route namespaces — nothing shared between them:

```
/staff/login                  -- renamed from /login

/customer/register
/customer/verify              (enter the 6-digit code just emailed)
/customer/login
/customer/forgot-password
/customer/reset-password      (enter code + new password)
/customer/account/profile     -- name, phone, picture
/customer/account/bookings    -- booking history
/customer/account/security    -- change password

/staff/bookings/new           -- staff creates a booking for an existing or walk-in customer
```

The last three share a tabbed `CustomerAccountLayout`, the same pattern `AdminLayout` already
established for the admin section — consistent with how this codebase already solves "a few
related pages under one shell."

A new `CustomerAuthContext` (parallel to the existing staff `AuthContext`, separate
`localStorage` keys, separate token) holds the logged-in customer. `BookPage` gets wrapped in
a customer-auth guard: an anonymous visitor hitting `/book` is redirected to
`/customer/login` (return path preserved, same pattern `RequireAuth` already uses for staff),
and once logged in, the customer-info step of the wizard is pre-filled from the profile instead
of typed fresh every time. `RequireAuth`'s existing redirect target also changes from `/login`
to `/staff/login` as part of the rename.

The main `AppBar` gets a second identity slot — a customer account menu (avatar/initials,
dropdown: My bookings, Profile, Log out — or Log in/Sign up when logged out) shown on
customer-facing pages, kept visually distinct from the existing staff login chip. Not one
combined "who's logged in" indicator — the two are different people using the app for
different reasons, and collapsing them into one menu would be confusing on a shared device
(e.g. a front-desk tablet where staff are logged in and a customer might also be looking up
their own booking).

## Email delivery (OTP)

No real email provider exists yet — Phase 6 already plans SES for booking confirmations, and
OTP emails naturally extend that. Until then: OTPs get logged to the backend console
(`console.log`) so the whole flow is testable end-to-end via Postman/the UI without any email
setup — a real provider is Phase 6's job, not this one's.

## Security details worth building in now, not deferring

- OTP: 6 digits, 10-minute expiry, max 5 attempts before requiring a fresh code, 60-second
  resend cooldown.
- Passwords: same bcrypt approach as staff (`services/auth.ts` already has the helpers —
  reused, not reimplemented).
- Generic error messages for both "email not found" and "wrong password" (login), and for
  forgot-password regardless of whether the email exists.

Explicitly **deferred** (flagged for Phase 7 — Testing & polish, same place other hardening
already lives): IP-based rate limiting on login/register endpoints, CAPTCHA, account lockout
after repeated failures.

## Migration/rollout order

Same backend-then-frontend pattern used for every phase so far:

1. Schema: `Customer`, `OtpCode`, `Booking.customerId` — new migration.
2. Backend: register + verify-otp + resend-otp.
3. Backend: login (with the unverified-email gate) + `kind`-aware JWT/middleware split.
4. Backend: forgot-password + reset-password + change-password.
5. Backend: profile GET/PATCH + picture upload (`multer`, local disk).
6. Backend: gate `POST /api/bookings` behind customer auth; add `GET /api/customer/bookings`.
7. Backend: `GET /api/staff/customers` search + `POST /api/staff/bookings` (walk-ins).
8. Frontend: rename `/login` to `/staff/login`; `CustomerAuthContext` + guard.
9. Frontend: register/verify/login/forgot/reset pages.
10. Frontend: account section (profile/bookings/security tabs).
11. Frontend: `BookPage` gated + auto-filled from profile; `AppBar` customer menu.
12. Frontend: `StaffBookingPage.tsx` (customer search + walk-in fallback), linked from Queue
    and Dashboard.
13. Postman collection + all four docs updated, as with every prior phase.

## Next step

All 13 steps above are built. Next up is Phase 6 (AWS deployment) — see
`booking-system-roadmap.md`.
