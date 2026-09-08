import { formatDateChipLabel, formatTime, toDateKey, upcomingDateKeys } from "@/utils/dates";

describe("toDateKey", () => {
  it("formats using local date parts, not UTC", () => {
    // 11:30pm local time on Jan 15th must stay "2026-01-15" even though toISOString() on a
    // timezone behind UTC would already have rolled over to the 16th — this is exactly the bug
    // toDateKey exists to avoid (see the comment in utils/dates.ts).
    const date = new Date(2026, 0, 15, 23, 30);
    expect(toDateKey(date)).toBe("2026-01-15");
  });

  it("pads single-digit months and days", () => {
    expect(toDateKey(new Date(2026, 2, 5))).toBe("2026-03-05");
  });
});

describe("upcomingDateKeys", () => {
  it("returns `count` consecutive days starting from the given date", () => {
    const from = new Date(2026, 0, 30);
    expect(upcomingDateKeys(4, from)).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });
});

describe("formatDateChipLabel and formatTime", () => {
  it("produce non-empty, locale-formatted strings", () => {
    expect(formatDateChipLabel("2026-01-15", "en")).toMatch(/2026|Jan|15/);
    expect(formatTime("2026-01-15T14:30:00.000Z", "en")).toMatch(/\d/);
  });
});
