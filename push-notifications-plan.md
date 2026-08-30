# Push Notifications & In-App Notifications — Plan

Status: **backend done, not yet run**. The code is written and typechecks apart from the
Prisma-generated types; the two setup commands in "Local setup" below have not been run in
this sandboxed dev environment (no Postgres, and Prisma's engine downloads are blocked here).
Frontend admin UI is **not** built yet — see "Not done yet" at the bottom.

## What this adds, in one paragraph

Customers get a notification list inside the app, backed by a stored `Notification` table, and
push delivery to their phone via Firebase Cloud Messaging. The mobile app registers its FCM
token and OS type at login (`DeviceToken`). Three things generate notifications: a **check-in**
(sent the moment staff scan the QR code), **appointment reminders** at configurable offsets
(6 hours and 1 hour before, by default), and **manual messages** staff type and send from the
admin side. Every notification is stored first and pushed second, so the in-app list is
complete even when push fails or the customer has no device registered.

## Decisions locked in

- **One provider: Firebase Cloud Messaging, for both platforms.** FCM relays to Apple's APNs
  server-side using the `.p8` auth key uploaded in the Firebase console, so iOS registers with
  Firebase's `getToken()` exactly like Android. One SDK, one token format, one credential to
  rotate. Going direct to APNs with `node-apn` would mean two senders for no gain at this scale.
  The abstraction boundary is `services/push.ts` — it is the only file that knows Firebase
  exists, so swapping providers later touches one file.
- **Store first, push second.** The `Notification` row is the source of truth. A customer with
  no device, revoked push permission, or an FCM outage still sees the message in-app. Push is
  best-effort delivery of something already durably recorded.
- **Reminders are a poll, not a per-booking timer.** A `node-cron` job every 5 minutes scans
  for bookings that have just crossed a configured offset. See "Why polling" below.
- **Idempotency lives in the database.** `Notification.dedupeKey` is `UNIQUE`; the reminder
  sweep writes `"<bookingId>:REMINDER:<offsetMins>"`. Overlapping ticks and mid-batch crashes
  are harmless — the duplicate insert loses, and `notify()` reports `{ reason: "duplicate" }`.
- **Settings are per-business**, stored as an array of minute offsets rather than two boolean
  columns, so adding a 24-hour reminder is a settings change, not a schema change.

## Data model

Four new tables (`prisma/migrations/20260830120000_add_push_notifications/`).

| Table | Purpose |
| --- | --- |
| `DeviceToken` | One row per (customer, device). FCM token + `platform` (IOS/ANDROID/WEB) + os/app/model strings. |
| `Notification` | The stored, in-app notification. Source of truth for the customer's list. |
| `NotificationDelivery` | One row per push attempt to one device — the audit trail for "I never got it". |
| `NotificationSetting` | Per-business reminder offsets, feature toggles, quiet hours. |

Three design points worth knowing:

- **`DeviceToken.token` is globally unique, not unique-per-customer.** A token identifies an
  app install, not a person. If two accounts log in on the same phone, the second registration
  must *move* the token to the new customer — otherwise the previous user's notifications keep
  landing on a device someone else is now holding. `routes/devices.ts` upserts on `token` for
  exactly this reason.
- **Dead tokens are disabled, not deleted.** `disabledAt` is set only when FCM explicitly says
  `registration-token-not-registered` / `invalid-registration-token`. A transient failure
  (quota, outage) leaves the token alone, so an FCM incident can't mass-disable every device in
  the database. Keeping the row also means old `NotificationDelivery` records still resolve.
- **`Notification` vs `NotificationDelivery` are deliberately separate.** One notification
  fans out to N devices, and exists even when N is zero.

## Why polling, not scheduled jobs

The obvious alternative is to schedule a job at booking time — `setTimeout`, or a BullMQ
delayed job. Both need the timer to survive a restart, and both need the timer to be *found and
cancelled* whenever a booking is rescheduled or cancelled. That bookkeeping is where this kind
of feature usually goes wrong.

A poll has neither problem. Every tick re-reads the current state of the `Booking` table, so a
cancelled booking simply stops matching, and a restart loses nothing. The cost is up to five
minutes of timing slack, which is irrelevant for a six-hour reminder.

The window is `[now + offset, now + offset + 8 min)`. The 8 minutes is wider than the 5-minute
tick on purpose: a slow tick or brief downtime shouldn't silently skip a reminder. Anything
older than that is treated as missed deliberately — a "your appointment is in 1 hour" push
arriving 40 minutes late is worse than useless.

Running two API instances would run the sweep twice, but the `dedupeKey` constraint already
prevents duplicate pushes, so scaling out degrades to wasted work rather than spam. Phase 6's
AWS path (EventBridge → Lambda calling `runReminderSweep`) removes even that.

## API

### Customer (Bearer = customer token)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/api/devices` | Register/refresh. Body: `{ token, platform, osVersion?, appVersion?, deviceModel? }`. Call at login **and** on every FCM token refresh. |
| `GET` | `/api/devices` | The customer's own devices. Raw tokens are never returned. |
| `DELETE` | `/api/devices` | **Call on logout.** Body: `{ token }`. Otherwise the phone keeps receiving the previous account's notifications. |
| `GET` | `/api/notifications` | `?cursor=&limit=20&unreadOnly=true`. Cursor pagination — this list grows at the top, and offset paging would re-serve rows. Returns `{ items, nextCursor }`. |
| `GET` | `/api/notifications/unread-count` | Drives the bell badge. Cheap `COUNT` on the `(customerId, createdAt)` index. |
| `POST` | `/api/notifications/:id/read` | Idempotent — marking an already-read notification returns success, not an error. |
| `POST` | `/api/notifications/read-all` | Clears the badge. |

### Staff / admin (Bearer = staff token)

| Method | Path | Role | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/staff/notifications` | STAFF, ADMIN | Body: `{ customerIds[], title, body, bookingId? }`. Max 200 recipients. Validates every id before sending anything, so a typo can't half-deliver. |
| `GET` | `/api/staff/notifications/sent` | STAFF, ADMIN | `?customerId=&limit=50`. Audit view. |
| `GET` | `/api/staff/notifications/settings` | STAFF, ADMIN | Reminder config for the caller's business. |
| `PATCH` | `/api/staff/notifications/settings` | **ADMIN only** | Any subset of `reminderOffsetsMins`, `remindersEnabled`, `checkInEnabled`, `bookingConfirmedEnabled`, `quietHoursStart`, `quietHoursEnd`. |

`reminderOffsetsMins` is the 6h/1h setting expressed in minutes: `[360, 60]` is the default.
Add `1440` for a day-ahead reminder — the cron loops over whatever is stored.

### Push payload shape

Every push carries a `data` block the app uses to deep-link:

```json
{ "screen": "BookingDetail", "bookingRef": "…", "notificationId": "…", "type": "BOOKING_REMINDER", "bookingId": "…" }
```

FCM requires every `data` value to be a string — anything structured must be stringified by the
caller.

## Quiet hours

Set `quietHoursStart` / `quietHoursEnd` (both, or neither) as `"HH:MM"`. Inside the window,
non-urgent notifications are still **stored** but not pushed. Evaluated in the *business's*
timezone, not the server's — a UTC server running a clinic in `Asia/Dhaka` would otherwise mute
the wrong six hours of the day. Windows that wrap past midnight (`22:00`–`07:00`) work.

Two things bypass quiet hours: the check-in confirmation (the customer is standing in the
waiting room right now), and manual staff messages (a human deliberately chose to send it —
quiet hours exist to stop *automated* sends at 3am, not to gag the front desk).

## Local setup

```bash
cd backend
npm install                 # adds firebase-admin, node-cron
npx prisma migrate dev      # applies 20260830120000_add_push_notifications
npx prisma generate         # regenerates the client with the four new models
npm run dev
```

**Firebase is optional for development.** With `FIREBASE_*` unset, `services/push.ts` logs to
the console instead of sending — the same stand-in approach `services/otp.ts` uses for email.
Notifications are still stored and returned by the API, so the whole flow is testable end to
end with no Firebase project.

To enable real push:

1. Firebase Console → Project Settings → Service accounts → **Generate new private key**.
2. Copy `project_id`, `client_email`, `private_key` into `FIREBASE_PROJECT_ID`,
   `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` in `.env`. Keep the literal `\n` sequences
   in the private key and wrap it in quotes — a dotenv value can't hold real newlines, and the
   missing conversion is the classic cause of an opaque "Invalid PEM formatted message".
3. For iOS: Project Settings → Cloud Messaging → upload the APNs `.p8` auth key from your
   Apple Developer account. Without this, Android works and iOS silently doesn't.

`REMINDERS_ENABLED=false` runs an instance that serves the API but doesn't sweep — useful when
running two copies locally.

## Mobile client checklist

1. On login success → `POST /api/devices` with the Firebase token and `platform`.
2. Register an `onTokenRefresh` handler → `POST /api/devices` again. FCM rotates tokens on
   reinstall, restore to a new device, and after long inactivity.
3. On logout → `DELETE /api/devices` with the current token.
4. Android: create a notification channel with id **`booking-updates`** — the server sends that
   `channelId`, and on Android 8+ a push to a channel that doesn't exist is dropped silently.
5. iOS: request notification permission, and make sure the app is using Firebase's `getToken()`,
   not a raw APNs device token. A raw APNs token registers successfully here and then never
   receives anything.

## Not done yet

- **Admin UI.** No React pages for "send a message" or the reminder settings form — the
  endpoints exist and are documented above.
- **`BOOKING_CONFIRMED` / `BOOKING_CANCELLED`.** The enum values, templates, and the
  `bookingConfirmedEnabled` setting all exist, but nothing calls `notify()` from
  `services/bookingCreation.ts` or the cancel path yet. Wiring them is a few lines each,
  mirroring the check-in trigger in `routes/bookings.ts`.
- **Per-customer notification preferences.** Settings are per-business only; a customer can't
  currently opt out of reminders while keeping check-in confirmations. Uninstalling or
  revoking OS permission is the only opt-out today.
- **Postman collection** has not been updated with the new endpoints.
