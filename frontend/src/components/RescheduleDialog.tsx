import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

type Slot = { startTime: string; endTime: string };
type SlotsResponse = { slots: Slot[]; note?: string };

// Same fetch-a-token-and-call-with-it shape both useAuthFetch (staff) and useCustomerAuthFetch
// (customer) return — passed in as a prop instead of importing either hook, so this one dialog
// works from both CustomerBookingsPage/BookingDetailsPage (customer) and the staff-facing
// booking views, with the caller deciding which identity's token goes on the request.
type AuthFetch = (input: string, init?: RequestInit) => Promise<Response>;

export type RescheduleDialogProps = {
  open: boolean;
  onClose: () => void;
  authFetch: AuthFetch;
  // e.g. "/api/bookings" (customer) or "/api/staff/bookings" (staff) — the dialog appends
  // "/:bookingRef/reschedule" itself, mirroring how the two backend route files split by actor.
  basePath: string;
  bookingRef: string;
  resourceId: string;
  serviceId: string;
  currentStartTime: string;
  onRescheduled: (updated: { startTime: string }) => void;
};

// Same service -> date -> slot picking UX as BookPage, reused here instead of duplicated,
// just scoped to one already-known service/resource and PATCHing an existing booking instead
// of POSTing a new one.
export default function RescheduleDialog({
  open,
  onClose,
  authFetch,
  basePath,
  bookingRef,
  resourceId,
  serviceId,
  currentStartTime,
  onRescheduled,
}: RescheduleDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [closureNote, setClosureNote] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset to a clean slate every time the dialog is (re)opened for a booking, rather than
  // carrying over the previous booking's date/slot selection.
  useEffect(() => {
    if (!open) return;
    setDate(today);
    setSlots(null);
    setClosureNote(null);
    setSelectedSlot(null);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingRef]);

  useEffect(() => {
    if (!open) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    // A native date input fires onChange once per completed segment (day, then month, then
    // year), each one re-triggering this effect — so a request for an in-progress date (e.g.
    // day filled in but year still last month's) can still be in flight when the request for
    // the final, fully-typed date goes out. `cancelled` drops any response that isn't from
    // the most recently fired effect, so an earlier response can't overwrite a later one that
    // resolved first.
    let cancelled = false;
    const params = new URLSearchParams({ resourceId, serviceId, date });
    fetch(`/api/slots?${params}`)
      .then((res) => res.json())
      .then((data: SlotsResponse) => {
        if (cancelled) return;
        setSlots(data.slots);
        setClosureNote(data.note ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load available times");
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, resourceId, serviceId]);

  async function handleConfirm() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch(`${basePath}/${bookingRef}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startTime: selectedSlot.startTime }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      onRescheduled(body);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reschedule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Reschedule booking</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Currently: {new Date(currentStartTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            type="date"
            label="New date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: today }}
            fullWidth
          />

          {closureNote && <Alert severity="warning">{closureNote}</Alert>}

          {loadingSlots && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading open slots…
              </Typography>
            </Stack>
          )}

          {!loadingSlots && !closureNote && slots && slots.length === 0 && (
            <Alert severity="info">No open slots for this date.</Alert>
          )}

          {!loadingSlots && slots && slots.length > 0 && (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {slots.map((slot) => {
                const isSelected = selectedSlot?.startTime === slot.startTime;
                const time = new Date(slot.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!selectedSlot || submitting} onClick={handleConfirm}>
          {submitting ? "Saving…" : "Confirm new time"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
