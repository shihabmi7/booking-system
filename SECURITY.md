# Security

## Reporting a vulnerability

Please report anything exploitable privately rather than in a public issue — email
**shihab.apps.developer@gmail.com**, or use GitHub's private
[security advisory](https://github.com/shihabmi7/booking-system/security/advisories/new) form.

## Status of this project

This is a learning project, not a production deployment. It has never handled real customer
data, and there is no hosted instance. If you intend to run it for real, the following need
attention first — they're deliberate simplifications, not oversights:

| Area | Current state | Needed before real use |
| --- | --- | --- |
| `JWT_SECRET` | A dev placeholder in `.env.example` | A long random secret, kept out of version control |
| Seeded logins | `admin@sunriseclinic.test` / `staff@sunriseclinic.test` with published passwords | Delete them; create real accounts |
| OTP delivery | `console.log` only — codes appear in server logs | A real email provider (SES is the plan) |
| Rate limiting | Only on OTP resend | Login, registration, and password reset all need it |
| File uploads | Local disk, 2 MB, MIME-checked | Object storage with its own domain, and virus scanning |
| Transport | Plain HTTP locally | TLS everywhere; JWTs must never travel unencrypted |
| CORS | Fully open (`cors()` with no options) | An explicit allowlist |
| Password reset | Reuses the 6-digit OTP | Fine with the existing expiry and attempt caps, but worth a longer token |

## What the repository does and doesn't contain

**Committed, and safe:** `docker-compose.yml` and `backend/.env.test` contain
`booking_user` / `booking_pass` and a `test-only-secret` JWT key. These configure a throwaway
local container and the test database — they grant access to nothing outside your own machine.
The seeded accounts use the reserved `.test` TLD, which cannot resolve on the public internet.

**Never committed:** `backend/.env` (gitignored), Firebase service-account credentials, and
uploaded profile pictures (`backend/uploads/`, gitignored except for `.gitkeep`).

If you fork this and add real credentials, put them in `backend/.env` — never in `.env.example`,
`.env.test`, or `docker-compose.yml`.
