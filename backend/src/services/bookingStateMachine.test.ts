import { describe, expect, it } from "vitest";
import { BookingStatus } from "@prisma/client";
import { canTransition } from "./bookingStateMachine";

const ALL_STATUSES: BookingStatus[] = ["BOOKED", "CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED"];

describe("canTransition", () => {
  it("allows BOOKED to move to CHECKED_IN, NO_SHOW, or CANCELLED", () => {
    expect(canTransition("BOOKED", "CHECKED_IN")).toBe(true);
    expect(canTransition("BOOKED", "NO_SHOW")).toBe(true);
    expect(canTransition("BOOKED", "CANCELLED")).toBe(true);
  });

  it("allows CHECKED_IN to move only to COMPLETED", () => {
    expect(canTransition("CHECKED_IN", "COMPLETED")).toBe(true);
    expect(canTransition("CHECKED_IN", "CANCELLED")).toBe(false);
    expect(canTransition("CHECKED_IN", "NO_SHOW")).toBe(false);
  });

  it("treats COMPLETED, NO_SHOW, and CANCELLED as terminal — no outgoing transitions", () => {
    for (const terminal of ["COMPLETED", "NO_SHOW", "CANCELLED"] as BookingStatus[]) {
      for (const target of ALL_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it("rejects a status transitioning to itself", () => {
    for (const status of ALL_STATUSES) {
      expect(canTransition(status, status)).toBe(false);
    }
  });
});
