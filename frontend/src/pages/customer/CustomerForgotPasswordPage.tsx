import { FormEvent, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import LockResetIcon from "@mui/icons-material/LockReset";

// /customer/forgot-password — public. Always shows the same generic message regardless of
// whether the email is registered (see backend/src/routes/customer.ts's anti-enumeration
// note) — this page can't tell the customer "check your email" vs "no account found" even if
// it wanted to, because the backend deliberately doesn't say which happened.
export default function CustomerForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillEmail = (location.state as { email?: string } | null)?.email || "";

  const [email, setEmail] = useState(prefillEmail);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/customer/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      setMessage(body.message || "If an account exists for this email, a password reset code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSubmitting(false);
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
              <LockResetIcon />
            </Box>
            <Typography variant="h5">Forgot password</Typography>
            <Typography variant="body2" color="text.secondary" align="center">
              Enter your email and we'll send a reset code.
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
              autoFocus
            />
            {error && <Alert severity="error">{error}</Alert>}
            {message && <Alert severity="success">{message}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? "Sending…" : "Send reset code"}
            </Button>
            <Button
              variant="text"
              onClick={() => navigate("/customer/reset-password", { state: { email } })}
              disabled={!email}
            >
              I already have a code
            </Button>
          </Stack>

          <Typography variant="body2" align="center" sx={{ mt: 3 }}>
            <Link component={RouterLink} to="/customer/login">
              Back to login
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
