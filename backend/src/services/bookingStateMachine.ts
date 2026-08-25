import { BookingStatus } from "@prisma/client";

// Explicit finite state machine for booking status. Listing exactly which transitions are
// allowed (rather than just letting any route set any status) is what prevents nonsense like
// completing a cancelled booking, or checking in something that's already checked in.
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  BOOKED: ["CHECKED_IN", "NO_SHOW", "CANCELLED"],
  CHECKED_IN: ["COMPLETED"],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}
