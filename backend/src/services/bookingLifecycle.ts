import { Booking, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { getAvailableSlots } from "./availability";
import { canTransition } from "./bookingStateMachine";
import { notify } from "./notifications";
import { getSettings } from "./notificationSettings";
import { bookingCancelled, bookingRescheduled } from "./notificationTemplates";

// Shared by the customer-facing (routes/bookings.ts) and staff-facing
// (routes/staffBookings.ts) cancel/reschedule endpoints — same relationship
// services/bookingCreation.ts has to its two callers: the only thing that differs between a
// customer cancelling their own booking and staff cancelling one on a customer's behalf is
// WHO is allowed to call it, which is the route's job to check before calling in here.

type LifecycleResult<T> =
  | { ok: true; status: 200; booking: T }
  | { ok: false; status: number; error: string };

// select shape both operations need for the notify() call afterward — the business's
// timezone (for formatting the new/old time in the customer's clinic's local time, not the
// server's) and the names notificationTemplates.ts's BookingLike expects.
const NOTIFY_INCLUDE = {
  service: { select: { name: true } },
  resource: { select: { businessId: true, name: true, business: { select: { name: true, timezone: true } } } },
} as const;

export async function cancelBooking(bookingRef: string): Promise<LifecycleResult<Booking>> {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: NOTIFY_INCLUDE,
  });
  if (!booking) return { ok: false, status: 404, error: "Booking not found" };

  if (!canTransition(booking.status, "CANCELLED")) {
    return { ok: false, status: 409, error: `Cannot cancel a booking with status ${booking.status}` };
  }

  const updated = await prisma.booking.update({
    where: { bookingRef },
    data: { status: "CANCELLED" },
  });

  // Fire-after-commit, same rule as everywhere else notify() is called from a route: the
  // cancellation already happened, so a push failure must not turn into a 500 on it.
  if (booking.customerId) {
    const settings = await getSettings(booking.resource.businessId);
    if (settings.bookingConfirmedEnabled) {
      await notify({
        customerId: booking.customerId,
        type: "BOOKING_CANCELLED",
        bookingId: booking.id,
        businessId: booking.resource.businessId,
        // A human (the customer or staff) just deliberately cancelled this — not an automated
        // batch job quiet hours are meant to suppress.
        urgent: true,
        ...bookingCancelled(booking),
      });
    }
  }

  return { ok: true, status: 200, booking: updated };
}

export async function rescheduleBooking(
  bookingRef: string,
  newStartTime: string
): Promise<LifecycleResult<Booking>> {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef },
    include: NOTIFY_INCLUDE,
  });
  if (!booking) return { ok: false, status: 404, error: "Booking not found" };

  // Not a state-machine transition (the status doesn't change) — just a hard "only while
  // BOOKED" rule, worded the same way the state-machine guards elsewhere in this file read.
  if (booking.status !== "BOOKED") {
    return { ok: false, status: 409, error: `Cannot reschedule a booking with status ${booking.status}` };
  }

  const start = new Date(newStartTime);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, status: 400, error: "startTime must be a valid ISO date string" };
  }

  // Same "is this actually an open slot" check createBooking uses — this booking's own
  // current slot doesn't need special-casing here: getAvailableSlots only excludes windows
  // that overlap an existing non-cancelled booking, so every OTHER slot on the date is
  // unaffected by this booking still occupying its old time.
  const service = await prisma.service.findUnique({ where: { id: booking.serviceId } });
  if (!service) return { ok: false, status: 404, error: "Service not found" };

  const date = start.toISOString().slice(0, 10);
  const availability = await getAvailableSlots(booking.resourceId, booking.serviceId, date);
  if (!availability.ok) {
    return { ok: false, status: 404, error: availability.error };
  }
  const isOpen = availability.slots.some((slot) => slot.startTime.getTime() === start.getTime());
  if (!isOpen) {
    return { ok: false, status: 409, error: availability.note || "That slot is not available. Please pick another." };
  }

  const end = new Date(start.getTime() + service.durationMins * 60_000);

  let updated: Booking;
  try {
    updated = await prisma.booking.update({
      where: { bookingRef },
      data: { startTime: start, endTime: end },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, status: 409, error: "That slot was just booked by someone else. Please pick another." };
    }
    throw err;
  }

  if (booking.customerId) {
    const settings = await getSettings(booking.resource.businessId);
    if (settings.bookingConfirmedEnabled) {
      await notify({
        customerId: booking.customerId,
        type: "BOOKING_RESCHEDULED",
        bookingId: booking.id,
        businessId: booking.resource.businessId,
        urgent: true,
        // bookingRescheduled() formats startTime, so build the template off the NEW time —
        // spread updated over the fetched relations rather than refetching.
        ...bookingRescheduled({ ...booking, startTime: updated.startTime }),
      });
    }
  }

  return { ok: true, status: 200, booking: updated };
}
