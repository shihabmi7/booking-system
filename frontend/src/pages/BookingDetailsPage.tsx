import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import Skeleton from "@mui/material/Skeleton";
import { ChipProps } from "@mui/material/Chip";

type BookingDetails = {
  bookingRef: string;
  customerName: string;
  status: string;
  startTime: string;
  service: { name: string; durationMins: number; price: string };
  resource: { name: string; business: { name: string } };
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
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Typography variant="h4">Booking details</Typography>

      {error && (
        <Alert severity="error">
          {error}. <Link component={RouterLink} to="/find-booking">Try another reference</Link>.
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
        </Card>
      )}
    </Stack>
  );
}
