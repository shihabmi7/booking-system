import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

type BookingDetails = {
  bookingRef: string;
  customerName: string;
  status: string;
  startTime: string;
  service: { name: string; durationMins: number; price: string };
  resource: { name: string; business: { name: string } };
};

// Shown two ways: redirected here right after a successful booking (BookPage), or via
// manual lookup (FindBookingPage). Same URL shape ("/bookings/:bookingRef") that Phase 4's
// QR check-in will scan directly into.
export default function BookingDetailsPage() {
  const { bookingRef } = useParams<{ bookingRef: string }>();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingRef) return;
    setBooking(null);
    setError(null);
    fetch(`/api/bookings/${bookingRef}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status === 404 ? "Booking not found" : `Request failed: ${res.status}`);
        }
        return res.json();
      })
      .then(setBooking)
      .catch((err) => setError(err.message));
  }, [bookingRef]);

  return (
    <div>
      <h1>Booking Details</h1>

      {error && (
        <p style={{ color: "crimson" }}>
          {error}. <Link to="/find-booking">Try another reference</Link>.
        </p>
      )}

      {!error && !booking && <p>Loading…</p>}

      {booking && (
        <ul>
          <li>Reference: {booking.bookingRef}</li>
          <li>Status: {booking.status}</li>
          <li>Customer: {booking.customerName}</li>
          <li>
            Service: {booking.service.name} ({booking.service.durationMins} min, ${booking.service.price})
          </li>
          <li>
            Provider: {booking.resource.name}, {booking.resource.business.name}
          </li>
          <li>Time: {new Date(booking.startTime).toLocaleString()}</li>
        </ul>
      )}
    </div>
  );
}
