import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAuthFetch } from "../auth/useAuthFetch";
import { useCustomerAuth } from "../auth/CustomerAuthContext";
import { useCustomerAuthFetch } from "../auth/useCustomerAuthFetch";
import RescheduleDialog from "../components/RescheduleDialog";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActions from "@mui/material/CardActions";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import Skeleton from "@mui/material/Skeleton";
import Button from "@mui/material/Button";
import { ChipProps } from "@mui/material/Chip";

type BookingDetails = {
  id: string;
  bookingRef: string;
  customerName: string;
  customerId: string | null;
  resourceId: string;
  serviceId: string;
  status: string;
  startTime: string;
  service: { name: string; durationMins: number; price: string };
  resource: { name: string; businessId: string; business: { name: string } };
  qrCode: string; // base64 PNG data URL, generated fresh on every fetch
};

// Same status vocabulary the backend's state machine uses (services/bookingStateMachine.ts)
// mapped to a Material color so the meaning is visible at a glance, not just in text.
const STATUS_COLOR: Record<string, ChipProps["color"]> = {
  BOOKED: "primary",
  CHECKED_IN: "warning",
  COMPLETED: "success",
  NO_SHOW: "error",
  CANCELLED: "default",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Stack>
  );
}

// Shown two ways: redirected here right after a successful booking (BookPage), or via
// manual lookup (FindBookingPage). Same URL shape ("/bookings/:bookingRef") a real QR scan
// would link straight into — the QR image below encodes exactly this bookingRef.
export default function BookingDetailsPage() {
  const { bookingRef } = useParams<{ bookingRef: string }>();
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const { customer } = useCustomerAuth();
  const customerAuthFetch = useCustomerAuthFetch();

  function load() {
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
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [bookingRef]);

  // Which identity, if either, is allowed to act on this booking — and which auth/base path
  // their requests use. A customer viewing their OWN booking and staff viewing ANY booking at
  // their own business both get the same two actions, just routed to the endpoint that checks
  // the matching ownership rule server-side (see routes/bookings.ts vs routes/staffBookings.ts).
  const asOwner =
    booking && customer && booking.customerId === customer.id
      ? { authFetch: customerAuthFetch, basePath: "/api/bookings" }
      : booking && user && booking.resource.businessId === user.businessId
        ? { authFetch: authFetch, basePath: "/api/staff/bookings" }
        : null;

  async function handleCancel() {
    if (!booking || !asOwner) return;
    if (!window.confirm(`Cancel this ${booking.service.name} appointment?`)) return;
    setCancelling(true);
    setActionError(null);
    try {
      const res = await asOwner.authFetch(`${asOwner.basePath}/${booking.bookingRef}/cancel`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      setBooking((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel booking");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Typography variant="h4">Booking details</Typography>

      {error && (
        <Alert severity="error">
          {/* /find-booking is staff-only now (see App.tsx/FindBookingPage.tsx) — a customer
              landing here on a bad reference is pointed at their own booking history instead,
              which also works logged-out (RequireCustomerAuth bounces through login and back). */}
          {error}. <Link component={RouterLink} to="/customer/bookings">View your bookings</Link>.
        </Alert>
      )}

      {!error && !booking && <Skeleton variant="rounded" height={220} />}

      {booking && (
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={booking.status === "BOOKED" ? 7 : 12}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90 }}>
                      Status
                    </Typography>
                    <Chip size="small" color={STATUS_COLOR[booking.status] ?? "default"} label={booking.status} />
                  </Stack>
                  <DetailRow label="Reference" value={booking.bookingRef} />
                  <DetailRow label="Customer" value={booking.customerName} />
                  <DetailRow
                    label="Service"
                    value={`${booking.service.name} (${booking.service.durationMins} min, $${booking.service.price})`}
                  />
                  <DetailRow label="Provider" value={`${booking.resource.name}, ${booking.resource.business.name}`} />
                  <DetailRow label="Time" value={new Date(booking.startTime).toLocaleString()} />
                </Stack>
              </Grid>

              {booking.status === "BOOKED" && (
                <Grid item xs={12} sm={5}>
                  <Stack spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      Show this QR code at check-in
                    </Typography>
                    <Card
                      variant="outlined"
                      sx={{ p: 1.5, display: "inline-flex", bgcolor: "background.default" }}
                    >
                      <img
                        src={booking.qrCode}
                        alt={`QR code for booking ${booking.bookingRef}`}
                        width={160}
                        height={160}
                      />
                    </Card>
                  </Stack>
                </Grid>
              )}
            </Grid>
          </CardContent>

          {/* Only rendered when the current viewer is actually allowed to act on this
              booking (see asOwner above) AND it's still BOOKED — matches the same
              status-gate CustomerBookingsPage uses for its row-level actions. */}
          {asOwner && booking.status === "BOOKED" && (
            <CardActions sx={{ px: 2, pb: 2 }}>
              {actionError && (
                <Alert severity="error" sx={{ width: "100%" }}>
                  {actionError}
                </Alert>
              )}
              <Button size="small" onClick={() => setRescheduleOpen(true)}>
                Reschedule
              </Button>
              <Button size="small" color="error" disabled={cancelling} onClick={handleCancel}>
                {cancelling ? "Cancelling…" : "Cancel booking"}
              </Button>
            </CardActions>
          )}
        </Card>
      )}

      {booking && asOwner && (
        <RescheduleDialog
          open={rescheduleOpen}
          onClose={() => setRescheduleOpen(false)}
          authFetch={asOwner.authFetch}
          basePath={asOwner.basePath}
          bookingRef={booking.bookingRef}
          resourceId={booking.resourceId}
          serviceId={booking.serviceId}
          currentStartTime={booking.startTime}
          onRescheduled={(updated) => setBooking((prev) => (prev ? { ...prev, startTime: updated.startTime } : prev))}
        />
      )}
    </Stack>
  );
}
