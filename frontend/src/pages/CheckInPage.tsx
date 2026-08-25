import { FormEvent, useState } from "react";
import { useAuthFetch } from "../auth/useAuthFetch";

type CheckInResult = {
  bookingRef: string;
  customerName: string;
  status: string;
  isLate: boolean;
};

// Staff-facing check-in: type or paste a booking reference and submit. This is the manual
// counterpart to an actual QR scanner — a camera-based scanner is a reasonable next step,
// but out of scope here since it needs device camera access this simple form doesn't.
export default function CheckInPage() {
  const authFetch = useAuthFetch();
  const [bookingRef, setBookingRef] = useState("");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bookingRef.trim()) return;

    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const res = await authFetch(`/api/bookings/${bookingRef.trim()}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "manual" }),
      });

      const body = await res.json();

      if (!res.ok) {
        // 404 (unknown reference) and 409 (invalid state transition, e.g. already checked
        // in) both come back as { error: "..." } — same handling either way for this form.
        throw new Error(body.error || `Request failed: ${res.status}`);
      }

      setResult(body);
      setBookingRef("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Staff Check-in</h1>
      <p>Enter a customer's booking reference to check them in.</p>

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        <input
          value={bookingRef}
          onChange={(e) => setBookingRef(e.target.value)}
          placeholder="Booking reference"
          style={{ flex: 1, padding: "0.4rem" }}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Checking in…" : "Check In"}
        </button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {result && (
        <div style={{ padding: "1rem", border: "1px solid #ccc" }}>
          <p>
            ✅ Checked in <strong>{result.customerName}</strong> ({result.bookingRef})
          </p>
          {result.isLate && (
            <p style={{ color: "#a05a00" }}>⚠ This check-in is more than 10 minutes after the scheduled time.</p>
          )}
        </div>
      )}
    </div>
  );
}
