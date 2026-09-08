import { apiFetch } from "./client";

export type Slot = { startTime: string; endTime: string };

// Matches backend/src/routes/slots.ts's response shape — an object, not a bare array, so a
// fully-closed day (holiday, weekly closure) can carry a `note` explaining why instead of an
// empty list with no context.
export type SlotsResponse = { slots: Slot[]; note?: string };

// GET /api/slots?resourceId=&serviceId=&date= — public, same as /api/services. Elapsed and
// already-booked slots are filtered server-side (services/availability.ts); this client
// deliberately doesn't re-derive that rule, so there's exactly one place the "is this slot
// really open" logic lives.
export function getSlots(resourceId: string, serviceId: string, date: string): Promise<SlotsResponse> {
  const params = new URLSearchParams({ resourceId, serviceId, date });
  return apiFetch<SlotsResponse>(`/api/slots?${params}`);
}
