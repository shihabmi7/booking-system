import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Explicit on top of Vitest's own dist/node_modules defaults — a stray `npm run build`
    // (or `dist/` checked in from somewhere) must never let compiled *.test.js sit alongside
    // the real *.test.ts and get picked up as a second, stale copy of the same suite.
    exclude: ["**/node_modules/**", "**/dist/**"],
    // Runs before EVERY test file, in every worker — see tests/setup.ts for why this has to
    // load .env.test before anything else imports db/prisma.ts (which reads DATABASE_URL at
    // PrismaClient construction time, not lazily).
    setupFiles: ["./tests/setup.ts"],
    // Integration tests share one Postgres connection pool and truncate real tables between
    // tests (see tests/helpers/db.ts) — running test FILES in parallel would let one file's
    // resetDb() wipe rows another file's test is mid-assertion on. Single-threaded is the
    // simplest way to make that safe without per-file database sandboxes.
    fileParallelism: false,
    testTimeout: 15000,
  },
});
