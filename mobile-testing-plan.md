# Mobile App Testing Plan

Companion to `mobile-app-plan.md`. Covers how each layer of the app gets tested, on what
devices, and at what point in the phased build — not just "write some tests," but which kind
of test catches which kind of bug, and when in Phase 0–9 each one comes online.

## Testing pyramid for this app

```
        ▲  Manual exploratory (real devices, pre-release)
       ╱ ╲
      ╱E2E╲     Maestro — full user flows
     ╱─────╲
    ╱ Integ. ╲  API client + Query hooks against a real/mocked backend
   ╱───────────╲
  ╱ Unit + Comp. ╲  Jest + React Native Testing Library — logic, forms, components
 ╱─────────────────╲
```

Most tests live at the bottom (cheap, fast, run on every commit); fewest at the top (slow,
flaky-prone, run before releases). Same shape as any healthy test suite — called out explicitly
because it's easy to over-invest in E2E first since it "looks like" the real app.

## 1. Unit tests — Jest

What: pure logic with no rendering — validation schemas (zod), date/slot formatting helpers,
the elapsed-slot check mirrored from `availability.ts` if it's duplicated client-side for
display, i18n key lookups, the API client's error-normalization logic (401 → session-cleared,
network-down → retry-prompt, etc.).

Where: `mobile/__tests__/unit/`, co-located `*.test.ts` next to the module is also fine.

When it comes online: Phase 0, with one real passing test before any feature screen exists —
the same "prove the harness works before trusting it" reasoning used for CI itself.

## 2. Component tests — React Native Testing Library

What: individual screens/components rendered in isolation with mocked navigation and mocked
API responses. Examples: Login form shows a validation error on a bad email; the slot picker
disables an elapsed slot and a boolean matches `availability.ts`'s real behavior; the booking
confirmation screen renders the QR image from a given base64 payload; the language switcher
actually re-renders visible strings when the locale changes.

Rule of thumb: if a bug here would be "the screen shows the wrong thing for a given prop/state,"
it belongs at this layer, not E2E — cheaper to write, faster to run, easier to pinpoint.

When it comes online: alongside each screen, Phases 2–5 (Auth, Book, My Bookings, Profile) —
not retrofitted after the fact.

## 3. Integration tests — API client against the real backend

What: the actual `fetch`-based API client (register → verify OTP → login → book → fetch
bookings) run against the real local backend (`npm run dev` in `backend/`), not mocks — catches
contract drift between what the mobile client assumes and what the backend actually returns,
the kind of bug unit tests with mocked responses can't see by construction.

How: a small `mobile/__tests__/integration/` suite, run in CI with the backend spun up as a
service container (Postgres + the Express app), same shape as any CI job that needs a live
dependency. Seeded via the existing `backend/prisma/seed.ts` so there's real service/resource
data to book against.

When it comes online: Phase 2 onward, growing with each feature phase — this is also where the
elapsed-slot rule, the closed-weekday/holiday rules, and OTP expiry get verified end to end
against real backend logic instead of assumptions about it.

## 4. End-to-end tests — Maestro

What: full user journeys through the actual built app (dev client or a `preview` EAS build),
driving real taps/typing, not mocked internals.

Core flows to script from the start:
1. Register → verify OTP → land on Home, logged in.
2. Browse Services → tap Book on one → pick a date/slot → confirm → see the QR confirmation.
3. My Bookings list shows the booking just created → tap into details.
4. Forgot password → reset → log in with the new password.
5. Edit profile (name/phone) → upload a picture → see it reflected.
6. Change password → log out → log back in with the new password.
7. Attempt to select a slot that's already elapsed or already booked → confirm it's not
   selectable (mirrors the backend rule, now checked at the UI layer too).

Why Maestro over Detox here: no native build step required to author/run flows against, which
matters more for this app (no custom native modules) than Detox's deeper native-level access
would.

When it comes online: one flow per feature phase (Phase 2 gets flow 1, Phase 3 gets flow 2,
etc.), all seven running together starting Phase 6 (polish) as a regression gate.

## 5. Manual exploratory testing — real devices

What automated tests won't catch on their own: actual camera/photo-picker permission prompts
firing correctly, haptics feeling right, keyboard avoidance/scroll behavior around text inputs,
how the app behaves when backgrounded mid-booking or with no network, real Bangla/Malay text
rendering (font fallback, line wrapping, layout overflow with longer translated strings — Bangla
and Malay strings often run longer than their English source).

Device/OS matrix (minimum, given no budget for a device lab):
- iOS: latest iOS on a real iPhone (physical device required for camera/picture-upload testing,
  push permissions later) + iOS Simulator on two screen sizes (compact + Pro Max) for layout.
- Android: one real mid-range Android phone (not just a flagship — this is where performance
  and layout bugs actually surface) + Android Emulator on two screen sizes.
- At least one small-screen device on each platform, since the bottom-tab + form-heavy layout
  is where cramped screens break first.

When it happens: a pass at the end of each feature phase (2–5), a full pass in Phase 6, and
again before each Phase 8 beta build and each Phase 9 store submission — not just once at the
very end.

## 6. Accessibility testing

Folded into the same passes as manual testing, not a separate one-off audit:
- VoiceOver (iOS) and TalkBack (Android) run through the core flows above — can a screen-reader
  user actually complete a booking.
- Font scaling: OS-level "larger text" setting on, check nothing clips or overlaps.
- Color contrast of the brand palette (teal/amber) checked against Material accessibility
  guidelines, not just eyeballed.
- Minimum touch target sizes on every tappable element, especially the slot-picker grid and
  the bottom tab bar.

When: alongside the Phase 6 polish pass, then spot-checked again in Phase 8.

## 7. Localization testing

- All three locales (en/bn/ms) exercised through every E2E flow at least once, not just visually
  spot-checked — a missing translation key should fail loudly (i18next configured to warn/error
  on missing keys in dev, not silently fall back).
- Bangla and Malay string lengths checked against actual UI (buttons, tab labels) for overflow.
- Date/number/currency formatting checked per locale once the currency decision from
  `mobile-app-plan.md`'s localization section is made.

When: Phase 1 (as locale files are seeded) and again in Phase 6.

## 8. Crash & error monitoring as a testing signal

Sentry (wired up from Phase 0) isn't just production monitoring — treat its dashboard as a live
test result during Phase 8 beta testing: any crash or handled-error spike from real testers is a
bug report that arrived before anyone had to file one. Review it as a standing item during beta,
not just after a complaint.

## 9. CI gating

Every push: lint + typecheck + unit + component tests (fast, so they run on every commit).
Every PR into main / before an EAS build: integration tests against a live backend service
container. Before a Phase 8 beta build or Phase 9 store submission: full Maestro E2E suite run
against the actual build artifact, not just dev mode.

## 10. Release regression checklist (Phase 8/9 gate)

Before any TestFlight/Play internal build and before final store submission, confirm all of:
register → verify → login → book → view booking → edit profile → change password → log out,
each exercised on both iOS and Android, in at least English and one other locale, on a real
device. This is the manual "does the whole thing actually work" pass that automated coverage
should make fast to execute, not a replacement for having automated coverage in the first place.
