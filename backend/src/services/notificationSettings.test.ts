import { describe, expect, it } from "vitest";
import { updateSettings } from "./notificationSettings";

// Every case here hits a validation branch that returns before updateSettings() ever touches
// the database (see the function — getSettings()/prisma.update() only run once every input
// has passed), so these run as pure unit tests with no test database needed. The
// database-touching success path is covered in tests/routes/staffNotifications.test.ts
// instead, through the real PATCH endpoint.
describe("updateSettings validation", () => {
  it("rejects a non-array reminderOffsetsMins", async () => {
    // @ts-expect-error deliberately wrong shape, to exercise the runtime guard
    const result = await updateSettings("business-1", { reminderOffsetsMins: "360" });
    expect(result.ok).toBe(false);
  });

  it("rejects a reminder offset of zero or negative minutes", async () => {
    const result = await updateSettings("business-1", { reminderOffsetsMins: [0] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/1 and 10080/);
  });

  it("rejects a reminder offset beyond 7 days (10080 minutes)", async () => {
    const result = await updateSettings("business-1", { reminderOffsetsMins: [10081] });
    expect(result.ok).toBe(false);
  });

  it("rejects a non-integer reminder offset", async () => {
    const result = await updateSettings("business-1", { reminderOffsetsMins: [90.5] });
    expect(result.ok).toBe(false);
  });

  it("rejects quietHoursStart that isn't 24-hour HH:MM", async () => {
    const result = await updateSettings("business-1", { quietHoursStart: "10:00 PM" });
    expect(result.ok).toBe(false);
  });

  it("rejects quietHoursStart set without a matching quietHoursEnd", async () => {
    const result = await updateSettings("business-1", { quietHoursStart: "22:00" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/set or cleared together/);
  });

  it("rejects quietHoursEnd set without a matching quietHoursStart", async () => {
    const result = await updateSettings("business-1", { quietHoursEnd: "07:00" });
    expect(result.ok).toBe(false);
  });
});
