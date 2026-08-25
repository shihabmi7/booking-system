import { FormEvent, useEffect, useState } from "react";
import { Link as RouterLink, useNavigate, useSearchParams } from "react-router-dom";
import { useCustomerAuth } from "../auth/CustomerAuthContext";
import { useCustomerAuthFetch } from "../auth/useCustomerAuthFetch";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";

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

// A linear booking wizard: pick a service -> pick a date -> pick an open slot -> confirm ->
// submit. Kept as a handful of useState pieces instead of one big form object, so each
// fetch's dependencies (what triggers it, what it needs) stay obvious. As of the
// customer-accounts phase, this page is wrapped in <RequireCustomerAuth> (see App.tsx) — an
// anonymous visitor never reaches it, so there's no customer-info form here anymore; name/
// phone/email come from the logged-in customer's own profile, both for the request (the
// backend ignores anything else) and for display.
export default function BookPage() {
  const navigate = useNavigate();
  const { customer } = useCustomerAuth();
  const customerAuthFetch = useCustomerAuthFetch();
  const [searchParams] = useSearchParams();

  const [services, setServices] = useState<Service[] | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");

  // Also used as the date picker's min= below — today's already-elapsed slots get filtered
  // server-side (see availability.ts), but there's no reason to let anyone pick yesterday at
  // all and then have to explain that via an empty slot list.
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [closureNote, setClosureNote] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

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

  // Pre-select a service passed via ?serviceId= — e.g. clicking "Book" next to a specific
  // service on ServicesPage. A query param rather than route state on purpose: it survives
  // the login redirect if the visitor wasn't logged in yet (RequireCustomerAuth preserves
  // pathname + search), and it makes "book this exact service" a shareable/bookmarkable link.
  // Runs once services are loaded, since the id has to actually match something in the list —
  // an unknown or missing id is silently ignored, leaving the dropdown on its default "Select
  // a service…" placeholder rather than erroring.
  useEffect(() => {
    if (!services) return;
    const requestedId = searchParams.get("serviceId");
    if (requestedId && services.some((s) => s.id === requestedId)) {
      setSelectedServiceId(requestedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services]);

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
      const res = await customerAuthFetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: selectedService.resourceId,
          serviceId: selectedService.id,
          startTime: selectedSlot.startTime,
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
    <Stack spacing={3} sx={{ maxWidth: 560 }}>
      <Typography variant="h4">Book an appointment</Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <TextField
              select
              label="Service"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              fullWidth
            >
              <MenuItem value="">
                <em>Select a service…</em>
              </MenuItem>
              {services?.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name} — {s.durationMins} min — ${s.price} ({s.resource.name})
                </MenuItem>
              ))}
            </TextField>

            {selectedService && (
              <TextField
                type="date"
                label="Date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: today }}
                fullWidth
              />
            )}

            {selectedService && closureNote && <Alert severity="warning">{closureNote}</Alert>}

            {selectedService && !closureNote && !slots && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Loading open slots…
                </Typography>
              </Stack>
            )}

            {selectedService && !closureNote && slots && slots.length === 0 && (
              <Alert severity="info">No open slots for this date.</Alert>
            )}

            {selectedService && slots && slots.length > 0 && (
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Available times
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {slots.map((slot) => {
                    const isSelected = selectedSlot?.startTime === slot.startTime;
                    const time = new Date(slot.startTime).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    return (
                      <Chip
                        key={slot.startTime}
                        label={time}
                        clickable
                        color={isSelected ? "primary" : "default"}
                        variant={isSelected ? "filled" : "outlined"}
                        onClick={() => setSelectedSlot(slot)}
                      />
                    );
                  })}
                </Stack>
              </Stack>
            )}

            {selectedSlot && customer && (
              <>
                <Divider />
                <Stack component="form" onSubmit={handleSubmit} spacing={2}>
                  <Typography variant="body2" color="text.secondary">
                    Booking as <strong>{customer.name}</strong> ({customer.email}
                    {customer.phone ? `, ${customer.phone}` : ""}) —{" "}
                    <Link component={RouterLink} to="/customer/account/profile">
                      not you?
                    </Link>
                  </Typography>
                  <Button type="submit" variant="contained" size="large" disabled={submitting}>
                    {submitting ? "Booking…" : "Confirm booking"}
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
