import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthFetch } from "../auth/useAuthFetch";
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
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";

type Service = {
  id: string;
  name: string;
  durationMins: number;
  price: string;
  resourceId: string;
  resource: { name: string; business: { name: string } };
};

type Slot = { startTime: string; endTime: string };
type SlotsResponse = { slots: Slot[]; note?: string };

type CustomerSearchResult = { id: string; name: string; email: string; phone: string | null };

type Mode = "existing" | "walkin";

// /staff/bookings/new — staff creating a booking on behalf of someone else, either an
// existing customer account (found via search) or a walk-in with no account at all. Same
// service -> date -> slot wizard shape as the customer-facing BookPage, with a "who is this
// for" step prepended — see customer-accounts-plan.md's "Staff-created bookings" section for
// why this is a separate endpoint (POST /api/staff/bookings) rather than reusing
// POST /api/bookings with a spoofed customer.
export default function StaffBookingPage() {
  const navigate = useNavigate();
  const authFetch = useAuthFetch();

  const [mode, setMode] = useState<Mode>("existing");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);

  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");

  const [services, setServices] = useState<Service[] | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [closureNote, setClosureNote] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedService = services?.find((s) => s.id === selectedServiceId) ?? null;
  const hasCustomer = mode === "existing" ? !!selectedCustomer : walkInName.trim().length > 0;

  useEffect(() => {
    fetch("/api/services")
      .then((res) => res.json())
      .then(setServices)
      .catch(() => setError("Failed to load services"));
  }, []);

  // Debounced customer search — waits 300ms after typing stops before hitting the API, so
  // searching "Jane" doesn't fire four separate requests for "J", "Ja", "Jan", "Jane".
  useEffect(() => {
    if (mode !== "existing" || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      authFetch(`/api/staff/customers?search=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, mode]);

  function refreshSlots(resourceId: string, serviceId: string, forDate: string) {
    const params = new URLSearchParams({ resourceId, serviceId, date: forDate });
    return fetch(`/api/slots?${params}`)
      .then((res) => res.json())
      .then((data: SlotsResponse) => {
        setSlots(data.slots);
        setClosureNote(data.note ?? null);
      });
  }

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
    if (!selectedService || !selectedSlot || !hasCustomer) return;

    setSubmitting(true);
    setError(null);

    const body =
      mode === "existing"
        ? {
            resourceId: selectedService.resourceId,
            serviceId: selectedService.id,
            startTime: selectedSlot.startTime,
            customerId: selectedCustomer!.id,
          }
        : {
            resourceId: selectedService.resourceId,
            serviceId: selectedService.id,
            startTime: selectedSlot.startTime,
            customerName: walkInName,
            customerPhone: walkInPhone || undefined,
          };

    try {
      const res = await authFetch("/api/staff/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        const resBody = await res.json();
        setError(resBody.error || "That slot is not available. Please pick another.");
        setSelectedSlot(null);
        refreshSlots(selectedService.resourceId, selectedService.id, date);
        return;
      }

      if (!res.ok) {
        const resBody = await res.json().catch(() => ({}));
        throw new Error(resBody.error || `Request failed: ${res.status}`);
      }

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
      <Typography variant="h4">New booking</Typography>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Who is this booking for?
              </Typography>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, next) => {
                  if (next) {
                    setMode(next);
                    setSelectedCustomer(null);
                    setSearchQuery("");
                  }
                }}
                size="small"
              >
                <ToggleButton value="existing">Existing customer</ToggleButton>
                <ToggleButton value="walkin">Walk-in (no account)</ToggleButton>
              </ToggleButtonGroup>

              {mode === "existing" && !selectedCustomer && (
                <Stack spacing={1}>
                  <TextField
                    label="Search by name, email, or phone"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    fullWidth
                    size="small"
                  />
                  {searching && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CircularProgress size={16} />
                      <Typography variant="caption" color="text.secondary">
                        Searching…
                      </Typography>
                    </Stack>
                  )}
                  {!searching && searchResults.length > 0 && (
                    <Paper variant="outlined">
                      <List disablePadding>
                        {searchResults.map((c) => (
                          <ListItemButton key={c.id} onClick={() => setSelectedCustomer(c)}>
                            <ListItemText
                              primary={c.name}
                              secondary={`${c.email}${c.phone ? ` · ${c.phone}` : ""}`}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    </Paper>
                  )}
                  {!searching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                    <Typography variant="caption" color="text.secondary">
                      No matching customers. Switch to "Walk-in" if they don't have an account.
                    </Typography>
                  )}
                </Stack>
              )}

              {mode === "existing" && selectedCustomer && (
                <Chip
                  label={`${selectedCustomer.name} (${selectedCustomer.email})`}
                  onDelete={() => setSelectedCustomer(null)}
                  color="primary"
                  sx={{ alignSelf: "flex-start" }}
                />
              )}

              {mode === "walkin" && (
                <Stack spacing={2}>
                  <TextField
                    label="Name"
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Phone (optional)"
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    fullWidth
                    size="small"
                  />
                </Stack>
              )}
            </Stack>

            {hasCustomer && (
              <>
                <Divider />
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
              </>
            )}

            {hasCustomer && selectedService && (
              <TextField
                type="date"
                label="Date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            )}

            {hasCustomer && selectedService && closureNote && <Alert severity="warning">{closureNote}</Alert>}

            {hasCustomer && selectedService && !closureNote && !slots && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <CircularProgress size={18} />
                <Typography variant="body2" color="text.secondary">
                  Loading open slots…
                </Typography>
              </Stack>
            )}

            {hasCustomer && selectedService && !closureNote && slots && slots.length === 0 && (
              <Alert severity="info">No open slots for this date.</Alert>
            )}

            {hasCustomer && selectedService && slots && slots.length > 0 && (
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

            {selectedSlot && (
              <>
                <Divider />
                <Stack component="form" onSubmit={handleSubmit} spacing={2}>
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
