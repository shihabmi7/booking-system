import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../../auth/CustomerAuthContext";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";

// /customer/verify — public. Enter the 6-digit code from Register/Login's "resend code" flow.
// On success, the backend auto-logs the customer in (returns a token), so this page finishes
// by writing that session into CustomerAuthContext and sending them straight to wherever they
// were originally headed — no separate "now go log in" step.
export default function CustomerVerifyPage() {
  const { setSession } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { email?: string; from?: string } | null;

  const [email, setEmail] = useState(state?.email || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/customer/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Verification failed: ${res.status}`);

      setSession(body.token, body.customer);
      navigate(state?.from || "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      const res = await fetch("/api/customer/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Resend failed: ${res.status}`);
      setInfo(body.message || "If an unverified account exists for this email, a new code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resend failed");
    } finally {
      setResending(false);
    }
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: { xs: 2, md: 6 } }}>
      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 4 }}>
          <Stack spacing={1} alignItems="center" sx={{ mb: 3 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                bgcolor: "primary.main",
                color: "primary.contrastText",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MarkEmailReadIcon />
            </Box>
            <Typography variant="h5">Verify your email</Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Enter the 6-digit code we sent to your email.
            </Typography>
          </Stack>

          <Stack component="form" onSubmit={handleSubmit} spacing={2}>
            <TextField
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoFocus={!state?.email}
            />
            <TextField
              label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              fullWidth
              autoFocus={!!state?.email}
              inputProps={{ maxLength: 6, inputMode: "numeric" }}
            />
            {error && <Alert severity="error">{error}</Alert>}
            {info && <Alert severity="success">{info}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? "Verifying…" : "Verify"}
            </Button>
            <Button variant="text" onClick={handleResend} disabled={resending || !email}>
              {resending ? "Sending…" : "Resend code"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
