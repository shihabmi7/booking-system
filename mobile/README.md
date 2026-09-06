# Booking System — Customer Mobile App

React Native (Expo) customer app for the [booking system](../README.md). **Phases 0-2 of
[`../mobile-app-plan.md`](../mobile-app-plan.md)** — tooling, routing, env config, the Paper theme
and full localization, and now customer auth (register, verify, log in, forgot/reset password).
Booking, bookings history, and profile screens start at Phase 3.

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

The first screen is now the auth entry point: **Register → Verify OTP → land signed in** (or
**Log in**, if you already have an account) is the Phase 2 milestone. The OTP is only
console.logged by the backend for now (`[OTP] EMAIL_VERIFY code for customer ...`) — real email
delivery is Phase 6 work — so watch the `backend && npm run dev` terminal for the code after
registering.

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
just a boolean — `app/index.tsx` holds a spinner on `"loading"` rather than flashing the login
screen for someone who is actually still signed in.

Screens live under `app/(auth)/` (register, verify, login, forgot-password, reset-password) and
validate with `react-hook-form` + `zod` schemas built from the active language
(`src/auth/validation.ts`) — so a validation message switches with the language switcher, not
just the labels around it. `app/(auth)/_layout.tsx` and `app/index.tsx` guard each other: signed
out redirects out of `/`, signed in redirects out of `/(auth)/*`.

`.maestro/register-verify-login.yaml` is the Phase 2 end-to-end flow. It needs the OTP code
supplied manually (`-e OTP_CODE=...`) — see the comment at the top of that file for why.

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
Currency formatting is also still undecided — the plan flags that the web app prints raw `$` strings
with no currency logic, and that needs a real answer before Phase 3 renders prices.

`app.config.ts` has no `android.package` / `ios.bundleIdentifier` yet — that's Phase 7's App
Store/Play Console setup — so `.maestro/register-verify-login.yaml`'s `appId` is a placeholder.

Phase 3 onward — booking, my-bookings, profile — is described in
[`../mobile-app-plan.md`](../mobile-app-plan.md).
