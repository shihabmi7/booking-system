import { prisma } from "../../src/db/prisma";

// Every model in prisma/schema.prisma, in one place — TRUNCATE ... CASCADE doesn't care about
// FK order, but this list has to be kept in sync with the schema by hand, so if a new model
// shows up in a test's assertions with unexpectedly-old data, this is the first thing to check.
const TABLES = [
  "Business",
  "User",
  "Customer",
  "OtpCode",
  "Resource",
  "Holiday",
  "Service",
  "Booking",
  "DeviceToken",
  "Notification",
  "NotificationDelivery",
  "NotificationSetting",
  "FavoriteService",
];

// Wipes every table between tests so each test starts from a genuinely empty database instead
// of whatever the previous test left behind. TRUNCATE (not DELETE FROM) because it's a single
// fast statement regardless of row count, and CASCADE follows FK references automatically —
// no need to order this list by dependency.
export async function resetDb(): Promise<void> {
  const quoted = TABLES.map((t) => `"${t}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE;`);
}

export { prisma };
