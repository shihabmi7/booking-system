# Booking System — Customer Mobile App

React Native (Expo) customer app for the [booking system](../README.md). **Phases 0-6 of
[`../mobile-app-plan.md`](../mobile-app-plan.md)** — tooling, routing, env config, the Paper theme,
full localization, customer auth, the full booking flow, booking history, profile/security, and a
polish + accessibility pass. Store readiness (Phase 7+) needs real, paid developer accounts this
plan can't set up unilaterally — see "Not done yet" below.

|                   |                                                 |
| ----------------- | ----------------------------------------------- |
| **Framework**     | Expo SDK 57 (managed workflow)                  |
| **Runtime**       | React Native 0.86, React 19                     |
| **Routing**       | Expo Router 6 (file-based, `app/`)              |
| **Data fetching** | TanStack Query 5                                |
| **Language**      | TypeScript 5 (strict)                           |
| **Testing**       | Jest (jest-expo) + React Native Testing Library |

## Run it

The backend has to be running first — see the [root README](../README.md#quick-start):

```bash
docker compose up -d          # from the repo root
cd backend && npm run dev     # http://localhost:4000
```

Then:

```bash
cd mobile
npm install
npm run android    # or: npm run ios
```

The first screen is the auth entry point: **Register → Verify OTP → land signed in** (or
**Log in**, if you already have an account). The OTP is only console.logged by the backend for
now (`[OTP] EMAIL_VERIFY code for customer ...`) — real email delivery is Phase 6 (AWS) work — so
watch the `backend && npm run dev` terminal for the code after registering. Once signed in, the
bottom tab bar is Home / Book / My Bookings / Profile — book a service end to end, see it in your
history with its QR code, and edit your profile.

The Phase 0 connection-check screen (device networking, Express, Postgres end to end, with the
resolved base URL printed) still exists at `/debug-connection` — open it from the dev menu's URL
bar if you need to rule out networking before debugging an auth failure.

### Where the API base URL comes from

`src/api/config.ts` resolves it, in this order:

1. `EXPO_PUBLIC_API_BASE_URL` from `.env`, if set (surfaced through `app.config.ts` → `extra`).
2. Otherwise a per-platform localhost default.

That default matters, because "localhost" is not one thing on a phone:

| Where the app runs  | Reaches the backend at      | Why                                                                                                                                     |
| ------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Android emulator    | `http://10.0.2.2:4000`      | `localhost` on an emulator is the emulator itself; `10.0.2.2` is the special alias for the host machine                                 |
| iOS simulator       | `http://localhost:4000`     | The simulator shares the Mac's network stack                                                                                            |
| **Physical device** | `http://<your-LAN-IP>:4000` | Neither default can work — set `EXPO_PUBLIC_API_BASE_URL` in `.env` (`cp .env.example .env`; find the IP with `ipconfig getifaddr en0`) |

## Theme and localization

`src/theme/index.ts` builds a Material 3 theme from the web app's palette (`frontend/src/theme.ts`)
— the same clinical teal and amber, so the two apps look like one product. Light and dark are both
defined; the active one follows the OS setting.

Three languages ship: **English, বাংলা, Bahasa Melayu**. On first launch the device locale decides,
falling back to English; after that a stored choice always wins, so switching the language sticks
across restarts. The switcher is `src/components/LanguageSwitcher.tsx`.

Two things worth knowing before adding strings:

- **Every key must exist in all three files.** i18next silently falls back to English for a missing
  key, so a forgotten translation is invisible until it shows up as a stray English word on
  someone's Bangla screen. `__tests__/i18n/locales.test.ts` fails the build instead.
- **Bangla needs the bundled font.** A device's default UI font often has no Bengali glyphs, which
  renders as tofu boxes. Noto Sans Bengali is bundled and applied by the theme for `bn` only.

## Auth (Phase 2)

`src/auth/CustomerAuthContext.tsx` mirrors the web app's `CustomerAuthContext`
(`frontend/src/auth/CustomerAuthContext.tsx`) — same shape, same endpoints
(`/api/customer/*`), no backend changes. The one deliberate difference: the JWT lives in
`expo-secure-store` (Keychain/Keystore-backed), not `AsyncStorage` — the mobile equivalent of the
`localStorage` tradeoff the web app accepts, except mobile has a secure-by-default option. The
customer profile itself (not a credential) stays in plain AsyncStorage. Restoring a session from
either is async, which is why auth status is `"loading" | "signedIn" | "signedOut"` rather than
just a boolean — `src/auth/RequireCustomerAuth.tsx` holds a spinner on `"loading"` rather than
flashing the login screen for someone who is actually still signed in.

Screens live under `app/(auth)/` (register, verify, login, forgot-password, reset-password) and
validate with `react-hook-form` + `zod` schemas built from the active language
(`src/auth/validation.ts`) — so a validation message switches with the language switcher, not
just the labels around it. `app/(auth)/_layout.tsx` and `app/(tabs)/_layout.tsx` guard each
other: signed out redirects out of `/(tabs)/*`, signed in redirects out of `/(auth)/*`.

`.maestro/register-verify-login.yaml` is the Phase 2 end-to-end flow. It needs the OTP code
supplied manually (`-e OTP_CODE=...`) — see the comment at the top of that file for why.

## Book, My Bookings, and Profile (Phases 3-5)

Everything past login lives under `app/(tabs)/`, one `RequireCustomerAuth` boundary
(`src/auth/RequireCustomerAuth.tsx`) wrapping the whole tab group — no individual screen inside
it re-checks auth status.

- **Book** (`app/(tabs)/book/`): Services list → date/slot picker → confirm, three screens
  matching the plan's spec exactly. The date picker is a rolling 14-day chip strip, not a
  calendar widget — deliberately, to avoid a new native dependency
  (`@react-native-community/datetimepicker` isn't installed) for a booking window that's
  realistically always "the next couple of weeks." Confirm generates one idempotency key per
  screen mount (`src/utils/idempotencyKey.ts`) so a retried submit can't double-book. The
  services list also carries a heart toggle per row plus an All/Favorites filter over the same
  list (`GET/POST/DELETE /api/favorites`, added after the initial build — see the audit note in
  `../mobile-app-plan.md`) — optimistic, with a rollback on failure.
- **Booking details** (`app/bookings/[bookingRef]/index.tsx`): deliberately public/unauthenticated,
  matching both the backend route and the web app's identical choice — a real QR scan should
  link straight in with no login. Reused for two purposes: the screen a fresh booking lands on,
  and what tapping a row in My Bookings opens. Reschedule/Cancel only render when the current
  session's customer owns the booking AND it's still BOOKED (`isOwner`/`canModify` computed
  against `useCustomerAuth()`, matching web's `asOwner` gating) — a signed-out viewer or a real
  QR scan sees the same read-only details either way.
- **Reschedule** (`app/bookings/[bookingRef]/reschedule.tsx`): a full-screen push, not a modal
  dialog the way the web app's `RescheduleDialog` is — reuses the Book stack's date/slot picker
  (`src/components/DateSlotPicker.tsx`, extracted from `book/slots.tsx` for this reuse) against
  the booking's own resourceId/serviceId (read off the same `["booking", bookingRef]` query
  `book/slots.tsx` reused, so no params need passing through the URL).
- **My Bookings** (`app/(tabs)/bookings/`): `FlatList` + pull-to-refresh against
  `GET /api/customer/bookings`, with the same Reschedule/Cancel row actions as the details screen
  (only while a row is BOOKED). `Alert.alert` — RN's `window.confirm` equivalent — confirms a
  cancel before it fires, matching the web app's own confirm-then-cancel flow.
- **Profile** (`app/(tabs)/profile/`): name/phone edit, picture upload
  (`expo-image-picker`, permission strings in `app.config.ts`), the language switcher, a link to
  **Security** (change password), and Log out. `queryClient.clear()` runs on logout so a second
  customer signing in on the same device never flashes the previous one's cached bookings/profile
  for a moment.
- **`src/auth/useAuthedFetch.ts`** is the one place a 401 from any customer-auth-gated endpoint
  gets handled — it logs the customer out and raises `SessionExpiredError`, mirroring the web
  app's `useCustomerAuthFetch`.

All of this verified live against a real backend + Postgres on an iOS Simulator: register →
verify → book a real open slot → favorite a service (confirmed persisted via `GET /api/favorites`)
→ see the booking in My Bookings with the right status chip → open its real QR code →
reschedule it to a different real open slot → cancel it → edit the real profile.

## Polish and accessibility (Phase 6)

- **Skeletons** (`src/components/Skeleton.tsx`, a Reanimated pulsing block, plus `CardSkeleton`)
  replace the bare spinners Services, My Bookings, booking details, and the slot picker used
  through Phases 3-5 — a shape roughly matching the eventual content, not just "something is
  loading."
- **Empty states** (`src/components/EmptyState.tsx`) — an icon plus a message — replace bare text
  for an empty services list, an empty My Bookings, and a date with no open slots (including the
  closed-day `note` from the backend).
- **Haptics**: `expo-haptics` fires a success notification at the two moments the plan calls out
  specifically — a verified OTP (landing signed in) and a confirmed booking — not sprinkled
  everywhere.
- **Motion**: `react-native-reanimated`'s `FadeIn` on the Home hero and the Confirm screen's
  review card — subtle, not a redesign.
- **Accessibility pass**: the profile picture's edit button was `size={18}` (react-native-paper
  sizes an `IconButton`'s touchable area as `size + 16`, so that rendered a ~34pt target); bumped
  to `size={28}` to clear the 44pt/48dp minimum both platforms' guidelines call for. Interactive
  cards (`Card` with `onPress`) carry an explicit `accessibilityRole="button"` — Paper's `Card`
  doesn't set one on its own the way `Chip`/`Button` do.
- **Dark mode** was already OS-following since Phase 1 (`src/theme/index.ts`); no separate
  in-app toggle was added — the plan's "Light/dark mode via Paper's theme switching" reads as
  the theme responding correctly, not a manual light/dark/system switch, and there was no
  standalone request for one.

## Checks

```bash
npm test         # Jest + React Native Testing Library
npm run typecheck
npm run lint
```

All three run in CI on every push ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).
Maestro flows under `.maestro/` are not wired into CI yet — they need a real device/simulator and
a running backend, and (for this one) a human or a log-scraping step to supply the OTP.

## Not done yet

Still open from Phase 0: **Sentry** (needs an account and a DSN) and **EAS project setup**
(`eas.json` has the three build profiles, but no EAS project is linked and no build has run).
`.env.production` is deliberately a `.invalid` placeholder until the backend is actually deployed.

The Bangla and Malay translations are a first pass and have not been reviewed by a native speaker.
Currency formatting is also still undecided — the plan flagged that the web app prints raw `$`
strings with no currency logic, and `src/utils/currency.ts`'s `formatPrice` does the same on
purpose, as the one place to fix once the business's actual currency is known.

`app.config.ts` has no `android.package` / `ios.bundleIdentifier` yet — that's Phase 7's App
Store/Play Console setup — so `.maestro/register-verify-login.yaml`'s `appId` is a placeholder.

A feature audit against the web app (`frontend/src/pages/customer/`) found favorites, cancel,
and reschedule missing from the original Phases 3-5 — not deferred on purpose, just not in the
initial phase list. All three are now implemented (see the Favorites/Reschedule/Cancel notes
above); `mobile-app-plan.md` documents the audit and where each landed. The same audit found the
in-app notifications inbox (`/customer/notifications` — distinct from push notifications, which
stay out of scope) missing too, and that one is deliberately still deferred.

A Maestro flow covering Book/My Bookings/Profile (including the new favorite/cancel/reschedule
actions) is a natural fast-follow but doesn't exist yet — only the Phase 2 register→verify→login
flow has a Maestro script so far. Screen-level component tests (React Native Testing Library
rendering a full screen, not just its API/logic layer) are also not yet written for
Book/Bookings/Profile — Phase 2's precedent (API client + validation + context unit tests) is
what's followed here too, but a full render-and-interact test per screen is still open work.

Phase 6's accessibility review was a targeted pass (touch targets, roles, the two haptic
touchpoints, empty states, skeletons) rather than a screen-by-screen audit with a real screen
reader (VoiceOver/TalkBack) — that's still worth doing before a store submission, not something
this pass claims to have covered.

Phase 7 (production readiness) onward is described in [`../mobile-app-plan.md`](../mobile-app-plan.md)
and needs real, paid Apple Developer ($99/yr) and Google Play ($25 one-time) accounts, a hosted
privacy policy, store assets (icons, screenshots), and a Sentry account — business/ops decisions
and payments this plan can't make unilaterally. Phases 8 (beta testing) and 9 (production release)
both depend on Phase 7 actually being done for real, not just planned.
