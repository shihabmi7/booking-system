type GenerateSlotsInput = {
  workingHoursStart: string; // "HH:MM", 24h
  workingHoursEnd: string; // "HH:MM", 24h
  durationMins: number;
  date: string; // "YYYY-MM-DD"
};

export type SlotCandidate = {
  startTime: Date;
  endTime: Date;
};

// Builds every possible startTime/endTime pair for a resource's working hours on a given
// date, sliced into back-to-back chunks of `durationMins`. This is a pure function — it
// knows nothing about existing bookings, which keeps it simple to test and reuse. Filtering
// out already-booked slots happens separately, in services/availability.ts.
//
// Known simplification: treats the server's local time as the resource's working-hours
// timezone. Real timezone-aware scheduling (a Business.timezone field already exists in the
// schema) is deferred — worth calling out as a gap, not something silently "handled."
export function generateSlotCandidates({
  workingHoursStart,
  workingHoursEnd,
  durationMins,
  date,
}: GenerateSlotsInput): SlotCandidate[] {
  const [startHour, startMin] = workingHoursStart.split(":").map(Number);
  const [endHour, endMin] = workingHoursEnd.split(":").map(Number);

  const rangeStart = new Date(`${date}T00:00:00`);
  rangeStart.setHours(startHour, startMin, 0, 0);

  const rangeEnd = new Date(`${date}T00:00:00`);
  rangeEnd.setHours(endHour, endMin, 0, 0);

  const slots: SlotCandidate[] = [];
  let cursor = new Date(rangeStart);

  while (true) {
    const slotEnd = new Date(cursor.getTime() + durationMins * 60_000);
    if (slotEnd > rangeEnd) break;
    slots.push({ startTime: new Date(cursor), endTime: slotEnd });
    cursor = slotEnd;
  }

  return slots;
}
