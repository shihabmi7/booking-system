import { apiFetch } from "./client";

// Bound to whatever the caller's useAuthedFetch() hook returns — keeps this module unaware of
// where the token comes from, the same reason apiFetch itself takes no token: a screen calls
// `createBooking(authedFetch, input)` with the hook result, and this file only owns the path
// and body shape.
type AuthedFetch = <T>(path: string, init?: RequestInit) => Promise<T>;

export const BOOKING_STATUSES = ["BOOKED", "CHECKED_IN", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// The shape GET /api/customer/bookings returns — matches backend/src/routes/customer.ts's
// `include`, no qrCode (that's only generated on the single-booking lookup below).
export type BookingSummary = {
  id: string;
  bookingRef: string;
  startTime: string;
  status: BookingStatus;
  service: { name: string; durationMins: number; price: string };
  resource: { name: string; business: { name: string } };
};

// The shape GET /api/bookings/:bookingRef returns — includes qrCode (a base64 PNG data URL,
// regenerated fresh on every fetch) and enough resource/service detail for a standalone details
// screen that didn't come from the list above.
export type BookingDetails = {
  id: string;
  bookingRef: string;
  customerName: string;
  customerId: string | null;
  status: BookingStatus;
  startTime: string;
  service: { name: string; durationMins: number; price: string };
  resource: { name: string; business: { name: string } };
  qrCode: string;
};

export type CreateBookingInput = { resourceId: string; serviceId: string; startTime: string; idempotencyKey: string };

// POST /api/bookings — requires customer auth; customerId/Name/Phone/Email all come from the
// logged-in customer's own profile server-side, never from this body (see backend/src/routes/
// bookings.ts). idempotencyKey is generated once per confirm-screen mount (see app/(tabs)/book/
// confirm.tsx) so a retried request after a timeout doesn't create a second booking.
export function createBooking(authedFetch: AuthedFetch, input: CreateBookingInput): Promise<BookingDetails> {
  return authedFetch<BookingDetails>("/api/bookings", { method: "POST", body: JSON.stringify(input) });
}

// GET /api/bookings/:bookingRef — deliberately public/unauthenticated (see backend's comment
// on that route): a real QR scan would link straight into it with no login involved. Used here
// for both the post-booking confirmation screen and My Bookings' "view details" row.
export function getBooking(bookingRef: string): Promise<BookingDetails> {
  return apiFetch<BookingDetails>(`/api/bookings/${bookingRef}`);
}

// GET /api/customer/bookings — the logged-in customer's own history, most recent first,
// scoped server-side by the token (no bookingRef/customerId query param).
export function getMyBookings(authedFetch: AuthedFetch): Promise<BookingSummary[]> {
  return authedFetch<BookingSummary[]>("/api/customer/bookings");
}
