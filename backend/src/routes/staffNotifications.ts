import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { notify } from "../services/notifications";
import { getSettings, updateSettings } from "../services/notificationSettings";

const router = Router();

const MAX_TITLE = 80;
const MAX_BODY = 400;
// Caps a single manual send. Not a technical limit — a guard against an accidental
// "notify everyone" click, which is unrecoverable once the phones have buzzed.
const MAX_RECIPIENTS = 200;

// POST /api/staff/notifications — staff or admin sends a message to one or more customers.
// Body: { customerIds: string[], title, body, bookingId? }
//
// Stored as type STAFF_MESSAGE with sentByUserId set, so the notification history
// distinguishes "the system reminded you" from "Dr. Rahman's front desk messaged you" —
// which matters when a customer asks who contacted them.
router.post("/", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const { customerIds, title, body, bookingId } = req.body ?? {};

  if (!Array.isArray(customerIds) || customerIds.length === 0) {
    return res.status(400).json({ error: "customerIds must be a non-empty array" });
  }
  if (customerIds.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: `Cannot send to more than ${MAX_RECIPIENTS} customers at once` });
  }
  if (typeof title !== "string" || !title.trim() || title.length > MAX_TITLE) {
    return res.status(400).json({ error: `title is required and must be at most ${MAX_TITLE} characters` });
  }
  if (typeof body !== "string" || !body.trim() || body.length > MAX_BODY) {
    return res.status(400).json({ error: `body is required and must be at most ${MAX_BODY} characters` });
  }

  // Verifies every id is a real customer before sending anything, so a typo'd id produces a
  // clean 400 instead of a half-delivered batch that's already reached some phones.
  const customers = await prisma.customer.findMany({
    where: { id: { in: customerIds } },
    select: { id: true },
  });
  if (customers.length !== customerIds.length) {
    const found = new Set(customers.map((c) => c.id));
    return res.status(400).json({ error: "Unknown customer id(s)", unknown: customerIds.filter((id: string) => !found.has(id)) });
  }

  const results = [];
  for (const customer of customers) {
    const result = await notify({
      customerId: customer.id,
      type: "STAFF_MESSAGE",
      title: title.trim(),
      body: body.trim(),
      bookingId: typeof bookingId === "string" ? bookingId : undefined,
      sentByUserId: req.user!.userId,
      businessId: req.user!.businessId,
      // No dedupeKey: a staff member sending the same text twice is a deliberate act
      // (a follow-up nudge), not a duplicate to swallow.
      //
      // urgent: a human chose to send this right now, so quiet hours don't apply — quiet
      // hours exist to stop AUTOMATED sends arriving at 3am, not to gag the front desk.
      urgent: true,
    });
    results.push({
      customerId: customer.id,
      sent: result.ok,
      pushed: result.ok ? result.pushed : 0,
      // Surfaced so the admin UI can warn "delivered in-app only — no device registered"
      // rather than implying the phone definitely buzzed.
      failed: result.ok ? result.failed : 0,
    });
  }

  res.status(201).json({ sent: results.filter((r) => r.sent).length, results });
});

// GET /api/staff/notifications/sent — audit view of what's been sent to customers, so staff
// can see whether a reminder actually went out before re-sending it manually.
router.get("/sent", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const customerId = typeof req.query.customerId === "string" ? req.query.customerId : undefined;
  const limitRaw = Number(req.query.limit);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

  const notifications = await prisma.notification.findMany({
    where: customerId ? { customerId } : {},
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      readAt: true,
      createdAt: true,
      customer: { select: { id: true, name: true, email: true } },
      sentByUser: { select: { id: true, email: true } },
      // Counts rather than rows — the audit view needs "did it reach a device", not the
      // full per-device breakdown, and this keeps the payload small on a 50-row page.
      _count: { select: { deliveries: true } },
    },
  });

  res.json(notifications);
});

// GET /api/staff/notifications/settings — the reminder configuration for the caller's own
// business. Readable by staff (so the front desk knows when reminders fire) but only an
// ADMIN can change it, below.
router.get("/settings", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const settings = await getSettings(req.user!.businessId);
  res.json(settings);
});

// PATCH /api/staff/notifications/settings — ADMIN only.
// Body: any subset of { reminderOffsetsMins, remindersEnabled, checkInEnabled,
//                       bookingConfirmedEnabled, quietHoursStart, quietHoursEnd }
//
// reminderOffsetsMins is the "6 hours before / 1 hour before" setting, expressed as minutes:
// [360, 60] is the default. Adding 1440 gives a day-ahead reminder with no code change —
// the cron loops over whatever is stored (see jobs/reminderScheduler.ts).
router.patch("/settings", requireAuth, requireRole(UserRole.ADMIN), async (req, res) => {
  const { reminderOffsetsMins, remindersEnabled, checkInEnabled, bookingConfirmedEnabled, quietHoursStart, quietHoursEnd } =
    req.body ?? {};

  // Explicit field pick rather than passing req.body through — stops a client from setting
  // businessId, id, or updatedAt by including them in the payload.
  const result = await updateSettings(req.user!.businessId, {
    ...(reminderOffsetsMins !== undefined ? { reminderOffsetsMins } : {}),
    ...(remindersEnabled !== undefined ? { remindersEnabled: Boolean(remindersEnabled) } : {}),
    ...(checkInEnabled !== undefined ? { checkInEnabled: Boolean(checkInEnabled) } : {}),
    ...(bookingConfirmedEnabled !== undefined ? { bookingConfirmedEnabled: Boolean(bookingConfirmedEnabled) } : {}),
    ...(quietHoursStart !== undefined ? { quietHoursStart } : {}),
    ...(quietHoursEnd !== undefined ? { quietHoursEnd } : {}),
  });

  if (!result.ok) return res.status(400).json({ error: result.error });
  res.json(result.settings);
});

export default router;
