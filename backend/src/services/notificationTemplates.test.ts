import { describe, expect, it } from "vitest";
import {
  bookingCancelled,
  bookingConfirmed,
  bookingReminder,
  bookingRescheduled,
  checkInConfirmed,
} from "./notificationTemplates";

// A booking 3pm UTC — formatted against "America/New_York" (UTC-4/5) below specifically to
// prove these templates actually apply the BUSINESS's timezone, not the server's or UTC.
// If formatTime/formatDay silently used the server's local zone instead, this would only fail
// where the test happens to run somewhere other than America/New_York — using an explicit,
// clearly-offset zone here means the assertion fails everywhere it should, not just in CI.
const booking = {
  id: "booking-1",
  bookingRef: "REF123",
  startTime: new Date("2026-09-01T19:30:00.000Z"), // 3:30 PM in America/New_York
  service: { name: "General Consultation" },
  resource: { name: "Dr. Rahman", business: { name: "Sunrise Clinic", timezone: "America/New_York" } },
};

describe("notificationTemplates", () => {
  it("bookingReminder humanizes the offset and includes a deep link", () => {
    const t = bookingReminder(booking, 360);
    expect(t.title).toBe("Appointment in 6 hours");
    expect(t.body).toContain("General Consultation");
    expect(t.body).toContain("Dr. Rahman");
    expect(t.body).toContain("3:30 PM");
    expect(t.data).toEqual({ screen: "BookingDetail", bookingRef: "REF123" });
  });

  it("bookingReminder falls back to minutes when the offset isn't a whole number of hours", () => {
    const t = bookingReminder(booking, 90);
    expect(t.title).toBe("Appointment in 90 minutes");
  });

  it("bookingReminder uses singular 'hour' for a 60-minute offset", () => {
    const t = bookingReminder(booking, 60);
    expect(t.title).toBe("Appointment in 1 hour");
  });

  it("checkInConfirmed mentions the service and provider, not the appointment time", () => {
    const t = checkInConfirmed(booking);
    expect(t.title).toBe("You're checked in");
    expect(t.body).toContain("General Consultation");
    expect(t.body).toContain("Dr. Rahman");
  });

  it("bookingConfirmed includes the day and time in the business's timezone", () => {
    const t = bookingConfirmed(booking);
    expect(t.title).toBe("Booking confirmed");
    expect(t.body).toContain("3:30 PM");
    expect(t.body).toContain("Dr. Rahman");
  });

  it("bookingRescheduled says the appointment moved, with the new day/time", () => {
    const t = bookingRescheduled(booking);
    expect(t.title).toBe("Booking rescheduled");
    expect(t.body).toContain("moved to");
    expect(t.body).toContain("3:30 PM");
  });

  it("bookingCancelled states the original day/time and stays deep-linkable", () => {
    const t = bookingCancelled(booking);
    expect(t.title).toBe("Booking cancelled");
    expect(t.body).toContain("cancelled");
    expect(t.data.bookingRef).toBe("REF123");
  });
});
