# React Native Customer App — Plan

Status: **planning, decisions locked in, not started**. New top-level folder `mobile/`,
alongside the existing `backend/` and `frontend/` — same backend, no backend changes needed,
just a second REST client. Target: real production releases on both the Apple App Store and
Google Play, not a demo build — so this plan includes the compliance/tooling/store work that
implies, not just the feature screens.

## What's changing, in one paragraph

A native mobile app for customers only — no staff/admin functionality, that stays web-only.
Covers everything a customer already does on the web (`/customer/*`, `/book`,
`/customer/bookings`, `/customer/account/*`): register, verify email via OTP, log in, forgot/
reset password, browse services, book an appointment, see booking history + QR code, edit
profile (name/phone/picture), change password. Talks to the exact same backend endpoints the
web frontend already uses — this is a new client, not a new API. Ships with three languages
(English, Bangla, Malay), a real dev/prod environment split, and everything both app stores
require for a first-party production listing: privacy manifests, data-safety disclosures,
crash monitoring, and store assets.

## Decisions locked in

- **Expo (managed workflow) + TypeScript.** Not bare React Native CLI — no native module needs
  here (camera/QR display, image picker, secure storage, and push notifications later are all
  covered by Expo's SDK), and Expo means no touching Xcode/Android Studio config directly for
  routine work, plus EAS Build produces real signed store binaries without owning build
  machines or a Mac for iOS builds specifically.
- **Expo Router** (file-based routing), not React Navigation configured by hand. Built on top
  of React Navigation (nothing is lost), adds automatic deep linking — useful for booking-
  confirmation links and "resume where you left off" after a login redirect, the same problem
  the web app solved by hand with location state in `RequireCustomerAuth`.
- **React Native Paper** (Material Design), themed to match the web app's palette
  (`frontend/src/theme.ts`: teal `#0f6e56` primary, amber `#b26a00` secondary). Worth being
  honest about this one: it's a solid, well-maintained choice, not the only defensible one —
  NativeWind or Tamagui are equally legitimate 2026 picks. Paper won here specifically for
  visual consistency with the MUI web app, not because it's the objectively "correct" answer.
- **TanStack Query** for server state + a plain **React Context** for the customer session —
  mirrors `CustomerAuthContext` on web, deliberately not introducing Redux/Zustand when this
  codebase has consistently preferred Context for that role.
- **react-hook-form + zod** for form validation, matching the backend's own rules (password
  min 8 chars, etc.) without hand-rolling `useState` + manual checks four times over.
- **expo-secure-store** for the JWT, not `AsyncStorage` — OS keychain/Keystore-backed, the
  mobile equivalent of the `localStorage` tradeoff already documented for the web app, except
  mobile has a secure-by-default option so there's no reason not to use it.
- **expo-image-picker** for the profile picture upload, posted as `multipart/form-data` to the
  existing `POST /api/customer/me/picture` — no backend change needed.
- **i18next + react-i18next + expo-localization** for localization — the documented de facto
  standard Expo + React Native i18n stack, not a custom-rolled solution.
- **Jest + React Native Testing Library** for unit/component tests, **Maestro** for end-to-end
  flows (login → book → see it in history) — Maestro over Detox specifically because it needs
  no native build step to write/run tests against, which matters more here than Detox's deeper
  native-level control, given this app has no custom native modules to test.
- **ESLint + Prettier + TypeScript strict mode**, enforced in CI, not just present in the repo.
- **Sentry** for crash/error monitoring — the standard RN choice, wired up from the first
  internal build, not bolted on right before launch.
- **EAS Update** for shipping JS-only fixes after release without a new store review — real
  production apps need a fast-follow path for the inevitable post-launch bug, and re-running a
  full App Store/Play review for a one-line fix is a genuine cost worth avoiding from day one.

## Environment config — dev vs prod base URL

```
mobile/
├── .env                # EXPO_PUBLIC_API_BASE_URL for local dev (see gotcha below)
├── .env.production      # EXPO_PUBLIC_API_BASE_URL for the deployed backend
├── app.config.ts        # reads process.env.EXPO_PUBLIC_API_BASE_URL, exposes via Constants
└── eas.json              # build profiles: development, preview, production
```

- Expo's own convention: any env var prefixed `EXPO_PUBLIC_` is inlined into the JS bundle at
  build time and readable via `process.env.EXPO_PUBLIC_API_BASE_URL` — no extra plumbing, and
  nothing sensitive belongs in it anyway (it's just a URL).
- `eas.json` gets three build profiles (`development`, `preview`, `production`).
  `development` builds a real device-installable dev client (not Expo Go, in case a native
  module gets added later). `preview` targets TestFlight/Play internal testing against a
  staging or prod-like backend. `production` is the real store build.
- **Alternative worth knowing about, not adopted yet:** EAS also offers hosted "Environment
  Variables" (configured via the EAS dashboard/CLI) instead of committing `.env` files to git —
  more relevant if this ever becomes a team project. Plain `.env` files are simpler and fine
  for a solo build; noting the more "enterprise-correct" option exists rather than pretending
  it doesn't.
- **Gotcha worth calling out now, not after debugging it blind:** "dev" doesn't mean
  `localhost` the way it does for a web browser on the same machine as the backend. An Android
  emulator reaches the host machine at `10.0.2.2`, not `localhost`; an iOS simulator can
  actually use `localhost`; a physical phone on the same Wi-Fi needs the dev machine's LAN IP
  (e.g. `192.168.x.x:4000`).
- **`EXPO_PUBLIC_API_BASE_URL` for `production` is a placeholder until Phase 6 (AWS deployment)
  of the backend actually exists** — a mobile app in production still needs a real publicly
  reachable API, which doesn't exist yet. This plan's Phase 5 (below) explicitly blocks on that.

## Localization (English, Bangla, Malay)

- Translation files: `mobile/src/i18n/locales/{en,bn,ms}.json`, flat key → string maps grouped
  by screen (`auth.login.title`, `book.selectService`, ...).
- Device locale auto-detected on first launch via `expo-localization`; falls back to English if
  it doesn't match one of the three. Persisted afterward so a language switcher in Profile can
  override it permanently.
- **Bangla font rendering:** bundle a Bangla-supporting font (e.g. Noto Sans Bengali) via
  `expo-font`, applied when the active locale is `bn` — system default fonts don't reliably
  render Bengali script on every device.
- **Numbers, dates, currency:** `Intl.NumberFormat`/`Intl.DateTimeFormat` keyed off the active
  locale. Also the moment to fix something the web app never addressed — prices are raw `$123`
  strings everywhere (`ServicesPage`, `BookPage`, `BookingDetailsPage`) with no real currency
  logic. Needs an actual decision on what currency this business operates in before formatting
  it three different ways across two apps.
- No RTL handling needed — English, Bangla, and Malay are all left-to-right.

## Navigation & screens

Bottom tab bar as primary navigation:

```
Tabs: Home · Book · My Bookings · Profile

Home            — hero + "Book an appointment" / "My bookings" CTAs (mirrors HomePage)
Auth stack      — Register → Verify OTP → Login → Forgot Password → Reset Password
Book stack      — Services list (optional service preselect) → Date/slot picker → Confirm
                  → Booking confirmation (QR from the existing base64 PNG data URL)
My Bookings     — list (pull-to-refresh, FlatList not a mapped ScrollView) → Booking details
Profile         — view/edit name+phone, picture upload, language switcher
  └ Security    — change password
```

## API integration

No backend changes. A thin API client wraps `fetch` with the stored token attached and a
shared 401 handler (clear session, redirect to Login) — the same shape as `useCustomerAuthFetch`
on web. Hits `/api/customer/*`, public `/api/services` + `/api/slots`, and customer-auth-gated
`POST /api/bookings` / `GET /api/bookings/:bookingRef`.

## Making the UI feel polished, not just functional

- Paper theming applied consistently (brand colors, typography scale, rounded corners).
- Skeleton loading states instead of bare spinners for lists — RN equivalent of the web app's
  `Skeleton` components.
- Subtle motion via `react-native-reanimated` — button feedback, screen transitions.
- `expo-haptics` on key actions (confirm booking, successful OTP verify).
- Empty-state illustrations ("no bookings yet") rather than bare text.
- Light/dark mode via Paper's theme switching.
- Accessibility as a standing requirement, not a single checklist item at the end: proper
  labels/roles on every interactive element (Paper's defaults help but don't guarantee this),
  minimum touch target sizes, and checking color contrast on the brand palette against Material
  guidelines — reviewed screen by screen as each one is built, not audited once at the end.

## Folder structure (sketch)

```
mobile/
├── app/                        # Expo Router routes (file-based)
│   ├── (tabs)/
│   │   ├── index.tsx           # Home
│   │   ├── book/                # Book stack
│   │   ├── bookings/            # My Bookings stack
│   │   └── profile/             # Profile + Security
│   └── (auth)/                  # Register/Verify/Login/Forgot/Reset
├── src/
│   ├── api/                     # fetch client, endpoint functions, TanStack Query hooks
│   ├── auth/                    # CustomerAuthContext, secure-store helpers
│   ├── i18n/                    # i18next setup + locales/{en,bn,ms}.json
│   ├── theme/                   # Paper theme matching web's palette
│   └── components/              # shared UI (SlotChip, StatusChip, BookingCard, ...)
├── __tests__/                   # Jest + React Native Testing Library
├── .maestro/                    # Maestro E2E flow files
├── app.config.ts
├── eas.json
├── .env
└── .env.production
```

## Phased plan

### Phase 0 — Foundations & tooling
Scaffold Expo + TypeScript + Router + env config, confirmed working end to end against the
local backend (a real network call succeeding is the milestone, not just "it builds"). ESLint +
Prettier + strict TypeScript wired in from the first commit. Jest + React Native Testing
Library configured with one real passing test, not just installed. Sentry wired into the app
shell so even Phase 0's build reports crashes. CI (GitHub Actions or EAS Workflows) running
lint + typecheck + unit tests on every push, before any feature screens exist to make skipping
this tempting.
**Interview angle:** why tooling/CI is set up before feature code, not after — the same
"catch it cheap and early" reasoning this project already applied to i18n and the elapsed-slot
Postman fix.

### Phase 1 — Theme + localization scaffolding
React Native Paper theme matching the web app's brand colors. i18next wired up, all three
locale files seeded with shared strings (nav labels, common buttons, error messages), a working
language switcher — before screens get built against hardcoded English strings that would all
need revisiting later.

### Phase 2 — Auth
Register, Verify OTP, Login, Forgot/Reset Password screens + `CustomerAuthContext` + secure
token storage. Unit tests for the auth API client and form validation; a Maestro flow for
register → verify → land logged in.

### Phase 3 — Book flow
Services list → date/slot picker → confirm → booking confirmation screen with QR. Maestro flow
covering an end-to-end booking.

### Phase 4 — My Bookings + booking details
List (FlatList, pull-to-refresh) → booking details screen, matching what's already scoped
server-side (`GET /api/customer/bookings`).

### Phase 5 — Profile + Security
Edit name/phone, picture upload (with iOS/Android permission-string setup — see Phase 7),
change password.

### Phase 6 — Polish & accessibility pass
Skeletons, motion, haptics, empty states, dark mode, and a dedicated accessibility review
across every screen built so far (not just spot-checked during Phases 2-5).

### Phase 7 — Production readiness (both platforms)
This is the phase most "build a feature" plans skip, and exactly where a demo app and a real
store listing diverge:
- **Apple:** Apple Developer Program enrollment ($99/year). Privacy Manifest
  (`PrivacyInfo.xcprivacy`) for any "Required Reason APIs" the app touches (Expo's docs cover
  this directly). As of April 2026, new submissions must build against the iOS 26 SDK — means
  using a current Expo SDK version at build time, not whatever was current when this plan was
  written. Sign in with Apple is **not** required here (that rule only triggers when offering
  *other* third-party/social login, and this app only has email+password — worth stating
  explicitly so it doesn't get built unnecessarily). App Tracking Transparency is **not**
  applicable either — no cross-app ad tracking.
- **Google:** Google Play Console account ($25 one-time). Google Play Data Safety form —
  directly relevant here, since the app collects email, phone, name, and photo, and that
  collection has to be accurately disclosed, not just checked through. Target API level:
  existing apps need to target Android 15 (API 35) or higher now; new apps/updates need Android
  16 (API 36) starting August 31, 2026 (extension available to November 1, 2026 if needed) — an
  Expo SDK version current enough to satisfy this at actual submission time, same reasoning as
  the iOS SDK point above. Android App Bundle (`.aab`), not APK, is what EAS Build produces for
  Play by default.
- **Both:** app icon + splash screen assets (multiple sizes), store screenshots per required
  device size, app description/keywords, support URL, and a **real, publicly hosted privacy
  policy page** — both stores require the URL, and this project doesn't have public hosting yet
  outside Phase 6's planned AWS deployment, so this needs an actual answer (even a simple static
  page somewhere) before submission, not a placeholder link. iOS `Info.plist` /
  `AndroidManifest.xml` permission usage strings for camera/photo library (`expo-image-picker`)
  — both stores reject submissions with missing usage descriptions.

### Phase 8 — Beta testing
TestFlight (internal, then external once ready — external requires a light Apple review) and
Google Play's internal/closed testing tracks. Sentry and analytics already wired in from Phase 0
means real crash/usage data starts flowing the moment beta testers install it, not after launch.

### Phase 9 — Production release
Google Play supports a staged percentage rollout; Apple App Store supports a phased release
over 7 days — use both rather than a single 100%-at-once release, so a bad build affects a small
slice of users before it affects everyone. `EAS Update` stays available afterward for JS-only
hotfixes without a new review cycle.

## Explicitly out of scope for this plan

Staff/admin mobile functionality (stays web-only), push notifications (a natural companion to
the planned SES/Lambda no-show sweep, but its own scoped addition, not folded in here), and
offline support. Worth naming as deliberately deferred, not forgotten.

## Next step

This plan is ready to build. Say the word and it starts at Phase 0, same phase-by-phase pattern
as everything before it in this project.
