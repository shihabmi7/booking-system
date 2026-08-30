import { NotificationSetting } from "@prisma/client";
import { prisma } from "../db/prisma";

// Per-business notification settings, created on first access rather than by a data-backfill
// migration — the same lazy-default pattern that keeps the migration in
// prisma/migrations/*_add_push_notifications purely structural.
export async function getSettings(businessId: string): Promise<NotificationSetting> {
  const existing = await prisma.notificationSetting.findUnique({ where: { businessId } });
  if (existing) return existing;

  // upsert, not create: two concurrent requests (a cron tick and an admin opening the
  // settings page) can both miss the findUnique above, and the second create would hit the
  // businessId unique constraint. upsert makes the race harmless.
  return prisma.notificationSetting.upsert({
    where: { businessId },
    create: { businessId },
    update: {},
  });
}

type UpdateInput = {
  reminderOffsetsMins?: number[];
  remindersEnabled?: boolean;
  checkInEnabled?: boolean;
  bookingConfirmedEnabled?: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
};

type Result = { ok: true; settings: NotificationSetting } | { ok: false; error: string };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

// Validates before writing — the reminder cron trusts these values completely (it turns each
// offset straight into a time window), so garbage here would silently break reminders rather
// than fail loudly at the point it was entered.
export async function updateSettings(businessId: string, input: UpdateInput): Promise<Result> {
  if (input.reminderOffsetsMins !== undefined) {
    const offsets = input.reminderOffsetsMins;
    if (!Array.isArray(offsets) || offsets.some((n) => !Number.isInteger(n) || n <= 0 || n > 10080)) {
      return { ok: false, error: "reminderOffsetsMins must be whole numbers of minutes between 1 and 10080 (7 days)." };
    }
    // Deduped and sorted furthest-out first, so a 6h reminder is always evaluated before the
    // 1h one and the stored list reads the way an admin expects it to.
    input.reminderOffsetsMins = [...new Set(offsets)].sort((a, b) => b - a);
  }

  for (const field of ["quietHoursStart", "quietHoursEnd"] as const) {
    const value = input[field];
    if (value !== undefined && value !== null && !HHMM.test(value)) {
      return { ok: false, error: `${field} must be a 24-hour "HH:MM" time, or null to disable quiet hours.` };
    }
  }

  // Quiet hours only mean something as a pair — one half set alone would leave the window
  // open-ended, and services/notifications.ts would have no second boundary to compare against.
  const start = input.quietHoursStart;
  const end = input.quietHoursEnd;
  if ((start === null && typeof end === "string") || (end === null && typeof start === "string")) {
    return { ok: false, error: "quietHoursStart and quietHoursEnd must be set or cleared together." };
  }

  await getSettings(businessId); // guarantees the row exists before update
  const settings = await prisma.notificationSetting.update({ where: { businessId }, data: input });
  return { ok: true, settings };
}
