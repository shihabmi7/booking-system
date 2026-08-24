import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

// Simple lookup form: the customer types their booking reference (from a confirmation
// email/QR code) and gets sent to the details page. This is the manual-entry counterpart
// to Phase 4's QR scan — same destination page, different way of getting there.
export default function FindBookingPage() {
  const [bookingRef, setBookingRef] = useState("");
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (bookingRef.trim()) {
      navigate(`/bookings/${bookingRef.trim()}`);
    }
  }

  return (
    <div>
      <h1>Find a Booking</h1>
      <p>Enter your booking reference to see the details.</p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          value={bookingRef}
          onChange={(e) => setBookingRef(e.target.value)}
          placeholder="Booking reference"
          style={{ flex: 1, padding: "0.4rem" }}
        />
        <button type="submit">Find</button>
      </form>
    </div>
  );
}
