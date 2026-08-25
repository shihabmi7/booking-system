import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

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
    <Stack spacing={3} sx={{ maxWidth: 480 }}>
      <Typography variant="h4">Find a booking</Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography color="text.secondary">Enter your booking reference to see the details.</Typography>
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
