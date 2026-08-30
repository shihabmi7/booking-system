import { schedule, ScheduledTask } from "node-cron";
import { prisma } from "../db/prisma";
import { notify } from "../services/notifications";
import { getSettings } from "../services/notificationSettings";
import { bookingReminder } from "../services/notificationTemplates";

// Sends the "your appointment is in 6 hours / 1 hour" reminders.
//
// Design: a poll, not a per-booking timer. Every 5 minutes this scans for bookings whose
// start time has just crossed a configured offset, and sends any reminder not already sent.
// The alternative — scheduling a job at booking time (setTimeout, or BullMQ delayed jobs) —
// needs the timer to survive restarts and to be found and cancelled whenever a booking is
// rescheduled or cancelled. A poll has neither problem: it reads the CURRENT state of the
// bookings table on every tick, so a cancelled booking simply stops matching, and a server
// restart loses nothing. The cost is up to 5 minutes of timing slack, which is irrelevant
// for a 6-hour reminder.
//
// Idempotency comes from the database, not from this file: each send carries a dedupeKey of
// "<bookingId>:REMINDER:<offset>", which is UNIQUE on Notification. Two overlapping ticks, or
// a crash halfway through a batch, can retry freely — the duplicate insert loses and notify()
// reports { reason: "duplicate" }. See services/notifications.ts.

const CRON_EXPRESSION = "*/5 * * * *"; // every 5 minutes

// How far past the exact offset moment a reminder may still be sent. Slightly wider than the
// 5-minute tick so a slow tick (or a brief downtime) doesn't silently skip a reminder
// entirely — better a reminder 8 minutes late than none at all. Anything older than this is
// treated as missed on purpose: a "your appointment is in 1 hour" push arriving 40 minutes
// late is worse than useless.
const WINDOW_MINUTES = 8;

export async function runReminderSweep(now: Date = new Date()): Promise<{ sent: number; skipped: number }> {
  let sent = 0;
  let skipped = 0;

  // Iterate per business, because reminder offsets, the enabled flag, and the timezone are
  // all per-business settings — there is no single global window to query.
  const businesses = await prisma.business.findMany({ select: { id: true } });

  for (const business of businesses) {
    const settings = await getSettings(business.id);
    if (!settings.remindersEnabled || settings.reminderOffsetsMins.length === 0) continue;

    for (const offsetMins of settings.reminderOffsetsMins) {
      // A booking is due for its `offsetMins` reminder when its start time falls inside
      // [now + offset, now + offset + window). Working forward from `now` this way (rather
      // than computing a send time per booking) turns the whole thing into one indexed
      // range scan on startTime.
      const windowStart = new Date(now.getTime() + offsetMins * 60_000);
      const windowEnd = new Date(windowStart.getTime() + WINDOW_MINUTES * 60_000);

      const bookings = await prisma.booking.findMany({
        where: {
          // BOOKED only: a cancelled booking shouldn't be reminded about, and someone who
          // has already checked in doesn't need telling they have an appointment.
          status: "BOOKED",
          // Walk-ins with no account can't receive a push — filtering here rather than
          // skipping them in the loop keeps the query result honest.
          customerId: { not: null },
          startTime: { gte: windowStart, lt: windowEnd },
          resource: { businessId: business.id },
        },
        select: {
          id: true,
          bookingRef: true,
          startTime: true,
          customerId: true,
          service: { select: { name: true } },
          resource: { select: { name: true, business: { select: { name: true, timezone: true } } } },
        },
      });

      for (const booking of bookings) {
        const template = bookingReminder(booking, offsetMins);
        const result = await notify({
          customerId: booking.customerId!,
          type: "BOOKING_REMINDER",
          bookingId: booking.id,
          businessId: business.id,
          // The unique key that makes this whole sweep safe to re-run. Includes the offset so
          // the 6h and 1h reminders for one booking are distinct rows, not duplicates.
          dedupeKey: `${booking.id}:REMINDER:${offsetMins}`,
          // Not urgent — a reminder IS the kind of automated send quiet hours exist to
          // suppress. It's still stored, so the customer sees it when they open the app.
          ...template,
        });

        if (result.ok) sent++;
        else skipped++;
      }
    }
  }

  return { sent, skipped };
}

let task: ScheduledTask | null = null;

export function startReminderScheduler(): void {
  if (task) return;

  // In-process cron is right for a single-instance MVP. Running two API instances would send
  // every reminder twice — except that the dedupeKey unique constraint already prevents that,
  // so horizontal scaling degrades to wasted work rather than duplicate pushes. The Phase 6
  // AWS path (EventBridge → Lambda calling runReminderSweep) removes even that.
  task = schedule(CRON_EXPRESSION, async () => {
    try {
      const { sent, skipped } = await runReminderSweep();
      // Only log when something happened — an idle clinic would otherwise produce 288 empty
      // log lines a day and bury anything real.
      if (sent > 0 || skipped > 0) {
        console.log(`[reminders] sent=${sent} skipped=${skipped}`);
      }
    } catch (err) {
      // Never let a throw escape the tick — an unhandled rejection here would take the whole
      // API process down with it, over a missed reminder.
      console.error("[reminders] Sweep failed:", err);
    }
  });

  console.log(`[reminders] Scheduler started (${CRON_EXPRESSION})`);
}

export function stopReminderScheduler(): void {
  task?.stop();
  task = null;
}
