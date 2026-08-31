import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { generateBookingQrCode } from "../services/qrCode";
import { canTransition } from "../services/bookingStateMachine";
import { createBooking } from "../services/bookingCreation";
import { requireAuth, requireRole } from "../middleware/auth";
import { requireCustomerAuth } from "../middleware/customerAuth";
import { notify } from "../services/notifications";
import { getSettings } from "../services/notificationSettings";
import { checkInConfirmed } from "../services/notificationTemplates";
import { cancelBooking, rescheduleBooking } from "../services/bookingLifecycle";

const router = Router();

// How late a customer can check in before the queue view flags them as late, without
// blocking the check-in itself — staff still decide what to do about a late arrival.
const LATE_GRACE_MINUTES = 10;

// POST /api/bookings — a CUSTOMER booking for themselves. Requires customer auth (added in
// the customer-accounts phase — this used to be fully public). customerId/Name/Phone/Email
// all come from the logged-in customer's own profile, never from the request body — a
// customer can't book "as" someone else here. Staff booking a walk-in on someone's behalf is
// a separate endpoint: POST /api/staff/bookings (routes/staffBookings.ts), which is the only
// place customer contact info still gets typed directly into the request.
router.post("/", requireCustomerAuth, async (req, res) => {
  const { resourceId, serviceId, startTime, idempotencyKey } = req.body;

  const customer = await prisma.customer.findUnique({ where: { id: req.customer!.customerId } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });

  try {
    const result = await createBooking({
      resourceId,
      serviceId,
      startTime,
      idempotencyKey,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// GET /api/bookings/:bookingRef — public lookup by the customer-facing booking reference.
router.get("/:bookingRef", async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef: req.params.bookingRef },
    include: {
      service: { select: { name: true, durationMins: true, price: true } },
      // businessId included alongside the display fields so the frontend can tell whether
      // the currently-logged-in staff member's own business owns this booking, without a
      // second request — same info staff-only routes already gate on, just surfaced here
      // since this lookup is intentionally public/unauthenticated (see comment above).
      resource: { select: { name: true, businessId: true, business: { select: { name: true } } } },
    },
  });

  if (!booking) return res.status(404).json({ error: "Booking not found" });
  const qrCode = await generateBookingQrCode(booking.bookingRef);
  res.json({ ...booking, qrCode });
});

// POST /api/bookings/:bookingRef/cancel — a CUSTOMER cancelling their own booking.
// Ownership is checked here (against req.customer, never a request-body field) before
// cancelBooking() runs — the staff equivalent (routes/staffBookings.ts) checks businessId
// ownership instead, since staff act on behalf of any customer at their business.
router.post("/:bookingRef/cancel", requireCustomerAuth, async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { bookingRef: req.params.bookingRef } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.customerId !== req.customer!.customerId) {
    return res.status(403).json({ error: "This isn't your booking" });
  }

  const result = await cancelBooking(req.params.bookingRef);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json(result.booking);
});

// PATCH /api/bookings/:bookingRef/reschedule — a CUSTOMER moving their own booking to a new
// time on the same service/resource. Body: { startTime }. Changing service or resource isn't
// supported here — that's a cancel + a fresh booking, not a reschedule.
router.patch("/:bookingRef/reschedule", requireCustomerAuth, async (req, res) => {
  const { startTime } = req.body ?? {};
  if (typeof startTime !== "string") {
    return res.status(400).json({ error: "startTime is required" });
  }

  const booking = await prisma.booking.findUnique({ where: { bookingRef: req.params.bookingRef } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.customerId !== req.customer!.customerId) {
    return res.status(403).json({ error: "This isn't your booking" });
  }

  const result = await rescheduleBooking(req.params.bookingRef, startTime);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json(result.booking);
});

// POST /api/bookings/:bookingRef/checkin — the QR scan (or manual booking-ref entry) endpoint.
// Body: { method?: "qr" | "manual" }. Staff/admin only — a customer's own possession of the
// bookingRef is enough to VIEW a booking (GET above), but not enough to change its state;
// otherwise anyone with the QR code (which is meant to be shown to staff) could check
// themselves in from home.
router.post("/:bookingRef/checkin", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef: req.params.bookingRef },
    include: {
      service: { select: { name: true } },
      resource: { select: { businessId: true, name: true, business: { select: { name: true, timezone: true } } } },
    },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this booking" });
  }

  if (!canTransition(booking.status, "CHECKED_IN")) {
    return res
      .status(409)
      .json({ error: `Cannot check in a booking with status ${booking.status}` });
  }

  const checkedInAt = new Date();
  const isLate = checkedInAt.getTime() > booking.startTime.getTime() + LATE_GRACE_MINUTES * 60_000;
  const method = req.body?.method === "qr" ? "qr" : "manual";

  const updated = await prisma.booking.update({
    where: { bookingRef: req.params.bookingRef },
    data: { status: "CHECKED_IN", checkedInAt, checkInMethod: method },
  });

  // Push the check-in confirmation AFTER the state change has committed, and deliberately
  // not inside a transaction with it: a Firebase timeout must never roll back a check-in that
  // physically happened at the front desk. Awaited (rather than fire-and-forget) only because
  // notify() already swallows its own failures — see services/notifications.ts.
  //
  // Skipped for walk-in bookings with no customer account (booking.customerId is null — see
  // schema.prisma), since there's no account to deliver to.
  if (booking.customerId) {
    const settings = await getSettings(booking.resource.businessId);
    if (settings.checkInEnabled) {
      const template = checkInConfirmed(booking);
      await notify({
        customerId: booking.customerId,
        type: "CHECK_IN_CONFIRMED",
        bookingId: booking.id,
        businessId: booking.resource.businessId,
        // The customer is standing in the waiting room right now — quiet hours must not
        // suppress the one notification they're actively waiting for.
        urgent: true,
        // dedupeKey off the booking, so a double-scan of the same QR code can't send two
        // "you're checked in" pushes. The state machine already blocks CHECKED_IN →
        // CHECKED_IN, but this makes the notification idempotent on its own terms.
        dedupeKey: `${booking.id}:CHECK_IN`,
        ...template,
      });
    }
  }

  res.json({ ...updated, isLate });
});

// POST /api/bookings/:bookingRef/no-show — staff manually marks a booking as a no-show
// (e.g. after waiting past the grace period with no check-in). An automated version of this
// — a scheduled sweep that runs without a human clicking anything — is Phase 6 (Lambda + EventBridge).
router.post("/:bookingRef/no-show", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef: req.params.bookingRef },
    include: { resource: { select: { businessId: true } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this booking" });
  }

  if (!canTransition(booking.status, "NO_SHOW")) {
    return res
      .status(409)
      .json({ error: `Cannot mark a booking with status ${booking.status} as a no-show` });
  }

  const updated = await prisma.booking.update({
    where: { bookingRef: req.params.bookingRef },
    data: { status: "NO_SHOW" },
  });
  res.json(updated);
});

// POST /api/bookings/:bookingRef/complete — staff marks a checked-in visit as finished.
router.post("/:bookingRef/complete", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef: req.params.bookingRef },
    include: { resource: { select: { businessId: true } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this booking" });
  }

  if (!canTransition(booking.status, "COMPLETED")) {
    return res
      .status(409)
      .json({ error: `Cannot complete a booking with status ${booking.status}` });
  }

  const updated = await prisma.booking.update({
    where: { bookingRef: req.params.bookingRef },
    data: { status: "COMPLETED" },
  });
  res.json(updated);
});

export default router;
