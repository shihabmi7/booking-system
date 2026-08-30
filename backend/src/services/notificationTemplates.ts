// Copy for every system-generated notification, kept in one file so the wording can be
// reviewed (and later translated) without hunting through route handlers and cron jobs.
// Staff-composed messages don't come through here — their title/body are typed by a human.

type BookingLike = {
  id: string;
  bookingRef: string;
  startTime: Date;
  service: { name: string };
  resource: { name: string; business: { name: string; timezone: string } };
};

// Formats a booking's start in the BUSINESS's timezone, not the server's or the customer's.
// "3:30 PM" has to mean 3:30 PM at the clinic — that's the time the customer needs to show up.
function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatDay(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

// Turns 360 → "6 hours", 60 → "1 hour", 90 → "90 minutes" — so one reminder template covers
// whatever offsets an admin has configured, rather than hardcoding the 6h/1h pair.
function humanizeOffset(minutes: number): string {
  if (minutes % 60 !== 0) return `${minutes} minutes`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

// Every template returns the same shape: what to show, plus the data block the mobile app
// uses to deep-link. All data values are strings — FCM's requirement (see services/push.ts).
export type Template = { title: string; body: string; data: Record<string, string> };

function deepLink(booking: BookingLike): Record<string, string> {
  return { screen: "BookingDetail", bookingRef: booking.bookingRef };
}

export function bookingReminder(booking: BookingLike, offsetMins: number): Template {
  const tz = booking.resource.business.timezone;
  return {
    title: `Appointment in ${humanizeOffset(offsetMins)}`,
    body: `${booking.service.name} with ${booking.resource.name} at ${formatTime(booking.startTime, tz)}. See you soon!`,
    data: deepLink(booking),
  };
}

export function checkInConfirmed(booking: BookingLike): Template {
  return {
    title: "You're checked in",
    body: `Thanks for checking in for your ${booking.service.name} appointment. Please take a seat — ${booking.resource.name} will see you shortly.`,
    data: deepLink(booking),
  };
}

export function bookingConfirmed(booking: BookingLike): Template {
  const tz = booking.resource.business.timezone;
  return {
    title: "Booking confirmed",
    body: `${booking.service.name} on ${formatDay(booking.startTime, tz)} at ${formatTime(booking.startTime, tz)} with ${booking.resource.name}.`,
    data: deepLink(booking),
  };
}

export function bookingCancelled(booking: BookingLike): Template {
  const tz = booking.resource.business.timezone;
  return {
    title: "Booking cancelled",
    body: `Your ${booking.service.name} appointment on ${formatDay(booking.startTime, tz)} at ${formatTime(booking.startTime, tz)} has been cancelled.`,
    data: deepLink(booking),
  };
}
