import dotenv from "dotenv";
import path from "path";

// Loaded via vitest.config.ts's setupFiles, which Vitest guarantees runs before a test
// file's own imports are evaluated — critical here because db/prisma.ts constructs its
// PrismaClient (reading process.env.DATABASE_URL) the moment anything imports it, including
// transitively via ../src/app. If DATABASE_URL from the real .env were still what's loaded,
// tests would run against the dev database instead of booking_db_test.
dotenv.config({ path: path.resolve(__dirname, "../.env.test"), override: true });
