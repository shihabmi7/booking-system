import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

// Simple lookup form: type in a booking reference and get sent to the details page. Staff-only
// (wrapped in <RequireAuth> in App.tsx as of the nav-separation cleanup) — a customer with an
// account uses "My bookings" instead, and a walk-in with no account has staff look this up for
// them (e.g. over the phone) rather than self-serving it. The underlying lookup,
// GET /api/bookings/:bookingRef, is still a public endpoint (it also backs the QR-scan flow
// and the post-booking confirmation redirect), so this page being staff-gated is a frontend
// policy choice, not a backend restriction.
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
    <Stack spacing={3} sx={{ maxWidth: 480 }}>
      <Typography variant="h4">Find a booking</Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography color="text.secondary">Enter a booking reference to see the details.</Typography>
            <Stack component="form" onSubmit={handleSubmit} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                placeholder="Booking reference"
                fullWidth
              />
              <Button type="submit" variant="contained">
                Find
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
