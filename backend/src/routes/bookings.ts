import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getAvailableSlots } from "../services/availability";
import { generateBookingQrCode } from "../services/qrCode";
import { canTransition } from "../services/bookingStateMachine";

const router = Router();

// How late a customer can check in before the queue view flags them as late, without
// blocking the check-in itself — staff still decide what to do about a late arrival.
const LATE_GRACE_MINUTES = 10;

// POST /api/bookings — creates a booking for a specific resource/service/startTime.
router.post("/", async (req, res) => {
  const {
    resourceId,
    serviceId,
    startTime,
    customerName,
    customerPhone,
    customerEmail,
    idempotencyKey,
  } = req.body;

  if (!resourceId || !serviceId || !startTime || !customerName) {
    return res
      .status(400)
      .json({ error: "resourceId, serviceId, startTime, and customerName are required" });
  }

  // Idempotency check: if this exact request was already submitted before (e.g. the client
  // retried after a timeout, unsure whether the first attempt succeeded), return the booking
  // that already exists instead of creating a second one.
  if (idempotencyKey) {
    const existing = await prisma.booking.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return res.status(200).json({ ...existing, qrCode: await generateBookingQrCode(existing.bookingRef) });
    }
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.resourceId !== resourceId) {
    return res.status(404).json({ error: "Service not found for this resource" });
  }

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) {
    return res.status(400).json({ error: "startTime must be a valid ISO date string" });
  }
  const end = new Date(start.getTime() + service.durationMins * 60_000);

  // Application-level check first: is this actually one of the currently-open slots?
  // This catches out-of-working-hours or overlapping requests with a clear error message.
  // NOTE: this check and the create() below are not atomic — two requests could both pass
  // this check for the same slot a moment apart (a "check-then-act" race condition). That's
  // exactly what the @@unique([resourceId, startTime]) database constraint exists to catch;
  // this check is for a good error message, the constraint is what's actually correct.
  const date = start.toISOString().slice(0, 10);
  const availability = await getAvailableSlots(resourceId, serviceId, date);
  if (!availability.ok) {
    return res.status(404).json({ error: availability.error });
  }
  const isOpen = availability.slots.some((slot) => slot.startTime.getTime() === start.getTime());
  if (!isOpen) {
    return res
      .status(409)
      .json({ error: availability.note || "That slot is not available. Please pick another." });
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        resourceId,
        serviceId,
        startTime: start,
        endTime: end,
        customerName,
        customerPhone,
        customerEmail,
        idempotencyKey: idempotencyKey || undefined,
      },
    });
    const qrCode = await generateBookingQrCode(booking.bookingRef);
    res.status(201).json({ ...booking, qrCode });
  } catch (err) {
    // P2002 = Prisma's unique constraint violation code. This is the race-condition backstop
    // described above — turns a raw DB error into a clean, expected API response instead of a 500.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "That slot was just booked by someone else. Please pick another." });
    }
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
      resource: { select: { name: true, business: { select: { name: true } } } },
    },
  });

  if (!booking) return res.status(404).json({ error: "Booking not found" });
  const qrCode = await generateBookingQrCode(booking.bookingRef);
  res.json({ ...booking, qrCode });
});

// POST /api/bookings/:bookingRef/checkin — the QR scan (or manual booking-ref entry) endpoint.
// Body: { method?: "qr" | "manual" }
router.post("/:bookingRef/checkin", async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { bookingRef: req.params.bookingRef } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

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

  res.json({ ...updated, isLate });
});

// POST /api/bookings/:bookingRef/no-show — staff manually marks a booking as a no-show
// (e.g. after waiting past the grace period with no check-in). An automated version of this
// — a scheduled sweep that runs without a human clicking anything — is Phase 6 (Lambda + EventBridge).
router.post("/:bookingRef/no-show", async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { bookingRef: req.params.bookingRef } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

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
router.post("/:bookingRef/complete", async (req, res) => {
  const booking = await prisma.booking.findUnique({ where: { bookingRef: req.params.bookingRef } });
  if (!booking) return res.status(404).json({ error: "Booking not found" });

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
