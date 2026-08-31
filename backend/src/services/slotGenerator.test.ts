import { describe, expect, it } from "vitest";
import { generateSlotCandidates } from "./slotGenerator";

describe("generateSlotCandidates", () => {
  it("slices a working day into back-to-back chunks of the given duration", () => {
    const slots = generateSlotCandidates({
      workingHoursStart: "09:00",
      workingHoursEnd: "10:00",
      durationMins: 20,
      date: "2026-09-01",
    });

    expect(slots).toHaveLength(3);
    expect(slots[0].startTime.getHours()).toBe(9);
    expect(slots[0].startTime.getMinutes()).toBe(0);
    // Each slot's end is exactly the next slot's start — no gaps, no overlap.
    expect(slots[0].endTime.getTime()).toBe(slots[1].startTime.getTime());
    expect(slots[2].endTime.getHours()).toBe(10);
  });

  it("drops a trailing slot that would run past closing time", () => {
    // 09:00-09:50 with a 20-minute service: 09:00-09:20, 09:20-09:40, then 09:40-10:00 would
    // overrun 09:50 — that partial slot must not appear at all, not be silently truncated.
    const slots = generateSlotCandidates({
      workingHoursStart: "09:00",
      workingHoursEnd: "09:50",
      durationMins: 20,
      date: "2026-09-01",
    });
    expect(slots).toHaveLength(2);
  });

  it("returns no slots when the service is longer than the entire working window", () => {
    const slots = generateSlotCandidates({
      workingHoursStart: "09:00",
      workingHoursEnd: "09:30",
      durationMins: 60,
      date: "2026-09-01",
    });
    expect(slots).toHaveLength(0);
  });

  it("anchors every slot to the requested date", () => {
    const slots = generateSlotCandidates({
      workingHoursStart: "09:00",
      workingHoursEnd: "11:00",
      durationMins: 30,
      date: "2026-12-25",
    });
    for (const slot of slots) {
      expect(slot.startTime.getFullYear()).toBe(2026);
      expect(slot.startTime.getMonth()).toBe(11); // 0-indexed — December
      expect(slot.startTime.getDate()).toBe(25);
    }
  });
});
