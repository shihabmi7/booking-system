import { Notification, NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { sendPush, PushResult } from "./push";
import { getSettings } from "./notificationSettings";

// The single entry point every notification in the app goes through: the check-in trigger
// (routes/bookings.ts), the reminder cron (jobs/reminderScheduler.ts), and staff sending a
// manual message (routes/staffNotifications.ts) all call notify().
//
// Two-step by design — STORE first, then push. The stored Notification row is the source of
// truth for the in-app list, so a customer with no device registered, a revoked push
// permission, or a Firebase outage still sees the message next time they open the app. Push
// is best-effort delivery of something already durably recorded, never the record itself.

export type NotifyInput = {
  customerId: string;
  type: NotificationType;
  title: string;
  body: string;
  bookingId?: string;
  // Values must be strings — FCM rejects a data block containing anything else, so structured
  // values have to be stringified by the caller rather than silently coerced here.
  data?: Record<string, string>;
  sentByUserId?: string;
  // Set for anything that must happen at most once (reminders). A duplicate key is caught
  // below and treated as "already sent", which is what makes the every-5-minutes cron safe.
  dedupeKey?: string;
  // Business whose settings govern quiet hours. Optional because a manual staff message is
  // deliberately exempt (see shouldSuppressPush).
  businessId?: string;
  // Bypasses quiet hours. True for anything the customer is actively waiting on — a check-in
  // confirmation at 7am shouldn't be silenced because quiet hours end at 8.
  urgent?: boolean;
};

export type NotifyResult =
  | { ok: true; notification: Notification; pushed: number; failed: number; skipped: boolean }
  // The dedupeKey already existed — not an error, just nothing new to do.
  | { ok: false; reason: "duplicate" }
  | { ok: false; reason: "error"; error: string };

// "HH:MM" → minutes since midnight, for comparing against a wall-clock time.
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Quiet hours are evaluated in the BUSINESS's timezone, not the server's — a UTC server
// running a clinic in Asia/Dhaka would otherwise mute the wrong six hours of the day.
// Intl is used rather than a date library because it's built in and this is the only place
// in the codebase that needs timezone-aware wall-clock arithmetic.
function isWithinQuietHours(now: Date, timezone: string, start: string, end: string): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const nowMins = hour * 60 + minute;

  const startMins = toMinutes(start);
  const endMins = toMinutes(end);
  // A window like 22:00–07:00 wraps past midnight, so the comparison flips from AND to OR.
  return startMins <= endMins
    ? nowMins >= startMins && nowMins < endMins
    : nowMins >= startMins || nowMins < endMins;
}

async function shouldSuppressPush(input: NotifyInput): Promise<boolean> {
  if (input.urgent || !input.businessId) return false;
  const settings = await getSettings(input.businessId);
  if (!settings.quietHoursStart || !settings.quietHoursEnd) return false;

  const business = await prisma.business.findUnique({
    where: { id: input.businessId },
    select: { timezone: true },
  });
  return isWithinQuietHours(new Date(), business?.timezone ?? "UTC", settings.quietHoursStart, settings.quietHoursEnd);
}

export async function notify(input: NotifyInput): Promise<NotifyResult> {
  let notification: Notification;
  try {
    notification = await prisma.notification.create({
      data: {
        customerId: input.customerId,
        bookingId: input.bookingId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
        sentByUserId: input.sentByUserId,
        dedupeKey: input.dedupeKey,
      },
    });
  } catch (err) {
    // P2002 = unique constraint violation. On dedupeKey that's the expected, benign outcome
    // of two cron ticks racing (or a retry after a crash mid-send) — the notification already
    // exists, so there is nothing to do. Letting the DB decide this, rather than a
    // findFirst-then-create check in application code, is what closes the race window entirely.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, reason: "duplicate" };
    }
    const error = err instanceof Error ? err.message : String(err);
    console.error("[notify] Failed to store notification:", error);
    return { ok: false, reason: "error", error };
  }

  const suppressed = await shouldSuppressPush(input);
  if (suppressed) {
    // Stored but intentionally silent — the customer will see it in the app.
    return { ok: true, notification, pushed: 0, failed: 0, skipped: true };
  }

  const devices = await prisma.deviceToken.findMany({
    where: { customerId: input.customerId, disabledAt: null },
    select: { id: true, token: true },
  });
  if (devices.length === 0) return { ok: true, notification, pushed: 0, failed: 0, skipped: false };

  const results = await sendPush(
    devices.map((d) => d.token),
    {
      title: input.title,
      body: input.body,
      data: {
        ...(input.data ?? {}),
        // Always included so the app can mark the notification read straight from the push,
        // and route to the right screen without a round trip.
        notificationId: notification.id,
        type: input.type,
        ...(input.bookingId ? { bookingId: input.bookingId } : {}),
      },
    },
  );

  await recordDeliveries(notification.id, devices, results);

  const pushed = results.filter((r) => r.ok).length;
  return { ok: true, notification, pushed, failed: results.length - pushed, skipped: false };
}

// Writes the audit trail and retires tokens FCM has told us are dead. Failures in here are
// logged and swallowed — bookkeeping must never surface as an error to the caller, whose
// actual work (the check-in, the booking) already succeeded.
async function recordDeliveries(
  notificationId: string,
  devices: { id: string; token: string }[],
  results: PushResult[],
): Promise<void> {
  const byToken = new Map(devices.map((d) => [d.token, d.id]));
  try {
    await prisma.notificationDelivery.createMany({
      data: results.map((r) => ({
        notificationId,
        deviceTokenId: byToken.get(r.token)!,
        status: r.ok ? ("SENT" as const) : ("FAILED" as const),
        providerMessageId: r.ok ? r.messageId : null,
        error: r.ok ? null : r.error,
      })),
    });

    // Only tokens FCM explicitly rejected as unregistered/invalid — a transient failure
    // (quota, outage) leaves tokenInvalid false, so an FCM incident can't mass-disable every
    // device in the database.
    const deadTokens = results.filter((r) => !r.ok && r.tokenInvalid).map((r) => r.token);
    if (deadTokens.length > 0) {
      await prisma.deviceToken.updateMany({
        where: { token: { in: deadTokens } },
        data: { disabledAt: new Date() },
      });
      console.log(`[notify] Disabled ${deadTokens.length} dead device token(s)`);
    }
  } catch (err) {
    console.error("[notify] Failed to record deliveries:", err);
  }
}
