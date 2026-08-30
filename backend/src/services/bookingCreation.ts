import { Booking, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getAvailableSlots } from "./availability";
import { generateBookingQrCode } from "./qrCode";
import { notify } from "./notifications";
import { getSettings } from "./notificationSettings";
import { bookingConfirmed } from "./notificationTemplates";

// Shared by both booking-creation entry points — a customer booking themselves
// (routes/bookings.ts) and a staff member booking a walk-in (routes/staffBookings.ts).
// Everything about validating a slot and creating the row is identical between the two; the
// only thing that differs is WHERE customerId/customerName/etc. come from (the logged-in
// customer's own profile vs. what staff typed/selected) — which is the caller's job, not
// this function's. Keeping that one function is what stops "how a booking gets created" from
// having two copies that could silently drift apart.
export type CreateBookingInput = {
  resourceId: string;
  serviceId: string;
  startTime: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  idempotencyKey?: string | null;
};

export type CreateBookingResult =
  | { ok: true; status: 200 | 201; booking: Booking & { qrCode: string } }
  | { ok: false; status: number; error: string };

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const { resourceId, serviceId, startTime, customerId, customerName, customerPhone, customerEmail, idempotencyKey } =
    input;

  if (!resourceId || !serviceId || !startTime || !customerName) {
    return { ok: false, status: 400, error: "resourceId, serviceId, startTime, and customerName are required" };
  }

  // Idempotency check: if this exact request was already submitted before (e.g. the client
  // retried after a timeout, unsure whether the first attempt succeeded), return the booking
  // that already exists instead of creating a second one.
  if (idempotencyKey) {
    const existing = await prisma.booking.findUnique({ where: { idempotencyKey } });
    if (existing) {
      return { ok: true, status: 200, booking: { ...existing, qrCode: await generateBookingQrCode(existing.bookingRef) } };
    }
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || service.resourceId !== resourceId) {
    return { ok: false, status: 404, error: "Service not found for this resource" };
  }

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, status: 400, error: "startTime must be a valid ISO date string" };
  }
  const end = new Date(start.getTime() + service.durationMins * 60_000);

  // Application-level check first: is this actually one of the currently-open slots?
  // NOTE: this check and the create() below are not atomic — the @@unique([resourceId,
  // startTime]) DB constraint (caught below as P2002) is the real backstop against a
  // check-then-act race; this check just gives a clean error message for the common case.
  const date = start.toISOString().slice(0, 10);
  const availability = await getAvailableSlots(resourceId, serviceId, date);
  if (!availability.ok) {
    return { ok: false, status: 404, error: availability.error };
  }
  const isOpen = availability.slots.some((slot) => slot.startTime.getTime() === start.getTime());
  if (!isOpen) {
    return { ok: false, status: 409, error: availability.note || "That slot is not available. Please pick another." };
  }

  try {
    const booking = await prisma.booking.create({
      data: {
        resourceId,
        serviceId,
        startTime: start,
        endTime: end,
        customerId: customerId || undefined,
        customerName,
        customerPhone: customerPhone || undefined,
        customerEmail: customerEmail || undefined,
        idempotencyKey: idempotencyKey || undefined,
      },
    });
    const qrCode = await generateBookingQrCode(booking.bookingRef);

    // Fire-after-commit, same rule as the check-in confirmation in routes/bookings.ts: the
    // booking already exists in the DB by this point, so a Firebase hiccup must not turn into
    // a 500 on an otherwise-successful booking. Only runs for a registered customer — a
    // walk-in typed in by staff (customerId null) has no account to deliver to.
    // The idempotencyKey early-return above means a retried request never reaches here twice.
    if (booking.customerId) {
      const resource = await prisma.resource.findUnique({
        where: { id: resourceId },
        select: { businessId: true, name: true, business: { select: { name: true, timezone: true } } },
      });
      if (resource) {
        const settings = await getSettings(resource.businessId);
        if (settings.bookingConfirmedEnabled) {
          const template = bookingConfirmed({
            id: booking.id,
            bookingRef: booking.bookingRef,
            startTime: booking.startTime,
            service: { name: service.name },
            resource: { name: resource.name, business: resource.business },
          });
          await notify({
            customerId: booking.customerId,
            type: "BOOKING_CONFIRMED",
            bookingId: booking.id,
            businessId: resource.businessId,
            // The customer is looking at the confirmation screen right now — quiet hours
            // exist to stop automated sends at 3am, not this one.
            urgent: true,
            ...template,
          });
        }
      }
    }

    return { ok: true, status: 201, booking: { ...booking, qrCode } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, status: 409, error: "That slot was just booked by someone else. Please pick another." };
    }
    // Anything else is unexpected — let it propagate so the caller's try/catch logs it and
    // returns a 500, rather than this shared function deciding how every caller reports it.
    throw err;
  }
}
