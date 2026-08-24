import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Service = {
  id: string;
  name: string;
  durationMins: number;
  price: string;
  resourceId: string;
  resource: { name: string; business: { name: string } };
};

type Slot = { startTime: string; endTime: string };

// GET /api/slots returns an object, not a bare array, so a fully-closed day can carry a
// `note` explaining why (a holiday or weekly closure) instead of just an empty list.
type SlotsResponse = { slots: Slot[]; note?: string };

// A linear booking wizard: pick a service -> pick a date -> pick an open slot -> enter
// customer info -> submit. Kept as a handful of useState pieces instead of one big form
// object, so each fetch's dependencies (what triggers it, what it needs) stay obvious.
export default function BookPage() {
  const navigate = useNavigate();

  const [services, setServices] = useState<Service[] | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [closureNote, setClosureNote] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedService = services?.find((s) => s.id === selectedServiceId) ?? null;

  // Load the service list once, on mount.
  useEffect(() => {
    fetch("/api/services")
      .then((res) => res.json())
      .then(setServices)
      .catch(() => setError("Failed to load services"));
  }, []);

  function refreshSlots(resourceId: string, serviceId: string, forDate: string) {
    const params = new URLSearchParams({ resourceId, serviceId, date: forDate });
    return fetch(`/api/slots?${params}`)
      .then((res) => res.json())
      .then((data: SlotsResponse) => {
        setSlots(data.slots);
        setClosureNote(data.note ?? null);
      });
  }

  // Re-fetch slots whenever the chosen service or date changes. Clears any previously
  // selected slot since it's tied to the old service/date and may no longer be valid.
  useEffect(() => {
    if (!selectedService) {
      setSlots(null);
      setClosureNote(null);
      return;
    }
    setSelectedSlot(null);
    setSlots(null);
    setClosureNote(null);
    refreshSlots(selectedService.resourceId, selectedService.id, date).catch(() =>
      setError("Failed to load slots")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServiceId, date]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedSlot) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: selectedService.resourceId,
          serviceId: selectedService.id,
          startTime: selectedSlot.startTime,
          customerName,
          customerPhone: customerPhone || undefined,
          customerEmail: customerEmail || undefined,
        }),
      });

      if (res.status === 409) {
        // Someone else took this slot (or it just became a holiday/closed day) between us
        // loading it and submitting — reflects the check-then-act race the backend's unique
        // constraint guards against. Refresh the slot list so it reflects reality again.
        const body = await res.json();
        setError(body.error || "That slot is not available. Please pick another.");
        setSelectedSlot(null);
        refreshSlots(selectedService.resourceId, selectedService.id, date);
        return;
      }

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      const booking = await res.json();
      navigate(`/bookings/${booking.bookingRef}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>Book an Appointment</h1>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <label style={{ display: "block", marginBottom: "1rem" }}>
        Service
        <select
          value={selectedServiceId}
          onChange={(e) => setSelectedServiceId(e.target.value)}
          style={{ display: "block", marginTop: "0.25rem" }}
        >
          <option value="">Select a service…</option>
          {services?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} — {s.durationMins} min — ${s.price} ({s.resource.name}, {s.resource.business.name})
            </option>
          ))}
        </select>
      </label>

      {selectedService && (
        <label style={{ display: "block", marginBottom: "1rem" }}>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ display: "block", marginTop: "0.25rem" }}
          />
        </label>
      )}

      {selectedService && closureNote && (
        <p style={{ color: "#a05a00" }}>{closureNote}</p>
      )}

      {selectedService && !closureNote && slots && slots.length === 0 && (
        <p>No open slots for this date.</p>
      )}

      {selectedService && slots && slots.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          <p>Available times:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {slots.map((slot) => {
              const isSelected = selectedSlot?.startTime === slot.startTime;
              const time = new Date(slot.startTime).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <button
                  key={slot.startTime}
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  style={{
                    padding: "0.4rem 0.8rem",
                    border: isSelected ? "2px solid #333" : "1px solid #ccc",
                    background: isSelected ? "#eee" : "white",
                    cursor: "pointer",
                  }}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedSlot && (
        <form onSubmit={handleSubmit}>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Name
            <input
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              style={{ display: "block", marginTop: "0.25rem" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Phone (optional)
            <input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              style={{ display: "block", marginTop: "0.25rem" }}
            />
          </label>
          <label style={{ display: "block", marginBottom: "1rem" }}>
            Email (optional)
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              style={{ display: "block", marginTop: "0.25rem" }}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? "Booking…" : "Confirm Booking"}
          </button>
        </form>
      )}
    </div>
  );
}
