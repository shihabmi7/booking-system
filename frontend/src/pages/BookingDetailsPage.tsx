import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

type BookingDetails = {
  bookingRef: string;
  customerName: string;
  status: string;
  startTime: string;
  service: { name: string; durationMins: number; price: string };
  resource: { name: string; business: { name: string } };
  qrCode: string; // base64 PNG data URL, generated fresh on every fetch
};

// Shown two ways: redirected here right after a successful booking (BookPage), or via
// manual lookup (FindBookingPage). Same URL shape ("/bookings/:bookingRef") a real QR scan
// would link straight into — the QR image below encodes exactly this bookingRef.
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
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
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

          {booking.status === "BOOKED" && (
            <div>
              <p>Show this QR code at check-in:</p>
              <img
                src={booking.qrCode}
                alt={`QR code for booking ${booking.bookingRef}`}
                width={180}
                height={180}
                style={{ border: "1px solid #ccc" }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
