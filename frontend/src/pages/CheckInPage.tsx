import { FormEvent, useState } from "react";
import { useAuthFetch } from "../auth/useAuthFetch";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";

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
    <Stack spacing={3} sx={{ maxWidth: 520 }}>
      <Typography variant="h4">Staff check-in</Typography>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography color="text.secondary">Enter a customer's booking reference to check them in.</Typography>
            <Stack component="form" onSubmit={handleSubmit} direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                placeholder="Booking reference"
                fullWidth
                autoFocus
              />
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? "Checking in…" : "Check in"}
              </Button>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            {result && (
              <Alert severity={result.isLate ? "warning" : "success"}>
                <AlertTitle>
                  Checked in {result.customerName} ({result.bookingRef})
                </AlertTitle>
                {result.isLate && "This check-in is more than 10 minutes after the scheduled time."}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
