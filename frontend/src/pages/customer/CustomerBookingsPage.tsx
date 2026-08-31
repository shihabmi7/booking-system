import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useCustomerAuthFetch } from "../../auth/useCustomerAuthFetch";
import RescheduleDialog from "../../components/RescheduleDialog";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import { ChipProps } from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Link from "@mui/material/Link";
import Button from "@mui/material/Button";

type BookingRow = {
  id: string;
  bookingRef: string;
  startTime: string;
  status: string;
  resourceId: string;
  serviceId: string;
  service: { name: string; durationMins: number; price: string };
  resource: { name: string; business: { name: string } };
};

// Same status-color mapping QueuePage uses for the staff-facing queue — one visual language
// for "what does BOOKED/CHECKED_IN/etc. look like" across both the staff and customer sides.
const STATUS_COLOR: Record<string, ChipProps["color"]> = {
  BOOKED: "primary",
  CHECKED_IN: "warning",
  COMPLETED: "success",
  NO_SHOW: "error",
  CANCELLED: "default",
};

// /customer/bookings — standalone top-level page, not nested under the /customer/account/*
// settings shell (Profile/Security) — booking history is what a customer came here to look
// at, not an account setting, so it gets its own place in the nav instead of living as a tab
// alongside Profile. GET /api/customer/bookings is scoped server-side to the logged-in
// customer's own id (no query params needed, unlike the staff queue which is resource+date
// scoped) — most recent first.
export default function CustomerBookingsPage() {
  const customerAuthFetch = useCustomerAuthFetch();
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancellingRef, setCancellingRef] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState<BookingRow | null>(null);

  function load() {
    customerAuthFetch("/api/customer/bookings")
      .then((res) => res.json())
      .then(setBookings)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load bookings"));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  async function handleCancel(booking: BookingRow) {
    if (!window.confirm(`Cancel your ${booking.service.name} appointment?`)) return;
    setCancellingRef(booking.bookingRef);
    setError(null);
    try {
      const res = await customerAuthFetch(`/api/bookings/${booking.bookingRef}/cancel`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      setBookings((prev) => prev?.map((b) => (b.bookingRef === booking.bookingRef ? { ...b, status: "CANCELLED" } : b)) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancellingRef(null);
    }
  }

  return (
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      {bookings && bookings.length === 0 && (
        <Alert severity="info">
          No bookings yet. <Link component={RouterLink} to="/book">Book an appointment</Link>.
        </Alert>
      )}

      {bookings && bookings.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date &amp; time</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Business</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {bookings.map((b) => (
                <TableRow key={b.bookingRef} hover>
                  <TableCell>
                    {new Date(b.startTime).toLocaleString([], {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>{b.service.name}</TableCell>
                  <TableCell>
                    {b.resource.business.name} — {b.resource.name}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={STATUS_COLOR[b.status] ?? "default"} label={b.status} />
                  </TableCell>
                  <TableCell>
                    <Link component={RouterLink} to={`/bookings/${b.bookingRef}`}>
                      View
                    </Link>
                  </TableCell>
                  <TableCell>
                    {/* Only a BOOKED appointment can be changed — the state machine (and the
                        reschedule guard) reject anything else, so hiding the actions here
                        avoids a click that always 409s. */}
                    {b.status === "BOOKED" && (
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => setRescheduling(b)}>
                          Reschedule
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          disabled={cancellingRef === b.bookingRef}
                          onClick={() => handleCancel(b)}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {rescheduling && (
        <RescheduleDialog
          open={!!rescheduling}
          onClose={() => setRescheduling(null)}
          authFetch={customerAuthFetch}
          basePath="/api/bookings"
          bookingRef={rescheduling.bookingRef}
          resourceId={rescheduling.resourceId}
          serviceId={rescheduling.serviceId}
          currentStartTime={rescheduling.startTime}
          onRescheduled={(updated) => {
            setBookings((prev) =>
              prev?.map((b) => (b.bookingRef === rescheduling.bookingRef ? { ...b, startTime: updated.startTime } : b)) ?? null
            );
          }}
        />
      )}

      {bookings === null && !error && (
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      )}
    </Stack>
  );
}
