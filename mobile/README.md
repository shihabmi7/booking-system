# Booking System — Customer Mobile App

React Native (Expo) customer app for the [booking system](../README.md). **Phases 0-1 of
[`../mobile-app-plan.md`](../mobile-app-plan.md)** — tooling, routing, env config, the Paper theme
and full localization. No feature screens yet; those start at Phase 2 (auth).

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

The first screen is a connection check. **"Backend reachable / Database connected" is the
milestone** — it means device networking, Express and Postgres are all working end to end. It
also prints the base URL it tried, which is the first thing you need when it doesn't work.

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

## Checks

```bash
npm test         # Jest + React Native Testing Library
npm run typecheck
npm run lint
```

All three run in CI on every push ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

## Not done yet

Still open from Phase 0: **Sentry** (needs an account and a DSN) and **EAS project setup**
(`eas.json` has the three build profiles, but no EAS project is linked and no build has run).
`.env.production` is deliberately a `.invalid` placeholder until the backend is actually deployed.

The Bangla and Malay translations are a first pass and have not been reviewed by a native speaker.
Currency formatting is also still undecided — the plan flags that the web app prints raw `$` strings
with no currency logic, and that needs a real answer before Phase 3 renders prices.

Phase 2 onward — auth, booking, my-bookings, profile — is described in
[`../mobile-app-plan.md`](../mobile-app-plan.md).
