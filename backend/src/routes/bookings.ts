import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getAvailableSlots } from "../services/availability";

const router = Router();

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
    if (existing) return res.status(200).json(existing);
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
    res.status(201).json(booking);
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
// This is the endpoint Phase 4's QR check-in will call.
router.get("/:bookingRef", async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef: req.params.bookingRef },
    include: {
      service: { select: { name: true, durationMins: true, price: true } },
      resource: { select: { name: true, business: { select: { name: true } } } },
    },
  });

  if (!booking) return res.status(404).json({ error: "Booking not found" });
  res.json(booking);
});

export default router;
