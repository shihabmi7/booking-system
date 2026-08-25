import { prisma } from "../db/prisma";
import { generateSlotCandidates, SlotCandidate } from "./slotGenerator";

export type AvailabilityResult =
  | { ok: true; slots: SlotCandidate[]; note?: string }
  | { ok: false; error: string };

// Shared by both GET /api/slots (browsing) and POST /api/bookings (validating a requested
// time is actually open) — one source of truth for "what counts as available" instead of
// two slightly-different implementations drifting apart.
export async function getAvailableSlots(
  resourceId: string,
  serviceId: string,
  date: string
): Promise<AvailabilityResult> {
  const [resource, service] = await Promise.all([
    prisma.resource.findUnique({ where: { id: resourceId } }),
    prisma.service.findUnique({ where: { id: serviceId } }),
  ]);

  if (!resource) return { ok: false, error: "Resource not found" };
  if (!service || service.resourceId !== resourceId) {
    return { ok: false, error: "Service not found for this resource" };
  }

  const requestedDate = new Date(`${date}T00:00:00`);

  // Weekly recurring closure (e.g. "closed every Friday") — checked first since it never
  // needs a database round trip beyond the resource we already fetched.
  if (resource.closedWeekdays.includes(requestedDate.getDay())) {
    return { ok: true, slots: [], note: "This resource is closed on this day of the week." };
  }

  // One-off closure (public holiday, planned closure) — applies to the whole business.
  const holiday = await prisma.holiday.findUnique({
    where: { businessId_date: { businessId: resource.businessId, date: requestedDate } },
  });
  if (holiday) {
    return { ok: true, slots: [], note: `Closed: ${holiday.reason || "Holiday"}` };
  }

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const existingBookings = await prisma.booking.findMany({
    where: {
      resourceId,
      status: { not: "CANCELLED" },
      startTime: { gte: dayStart, lte: dayEnd },
    },
    select: { startTime: true, endTime: true },
  });

  const candidates = generateSlotCandidates({
    workingHoursStart: resource.workingHoursStart,
    workingHoursEnd: resource.workingHoursEnd,
    durationMins: service.durationMins,
    date,
  });

  // "Available" means two things, not one: not already booked, AND not already in the past.
  // The past-time check is a no-op for any future date (every candidate's startTime is
  // already >= now), so this doesn't need a separate "is this today" branch — it just quietly
  // does nothing on days where it can't possibly matter. Excluded from the list entirely
  // rather than returned-but-flagged-disabled, same treatment as an already-booked slot below
  // — one consistent rule for "what counts as bookable," not two different reasons rendered
  // two different ways on the frontend.
  const now = new Date();

  // Standard interval-overlap check: two ranges overlap if one starts before the other ends,
  // in both directions. Anything overlapping an existing (non-cancelled) booking is excluded.
  const available = candidates.filter(
    (slot) =>
      slot.startTime > now &&
      !existingBookings.some(
        (booking) => slot.startTime < booking.endTime && booking.startTime < slot.endTime
      )
  );

  return { ok: true, slots: available };
}
