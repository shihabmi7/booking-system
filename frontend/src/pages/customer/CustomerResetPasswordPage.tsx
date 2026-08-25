import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import LockResetIcon from "@mui/icons-material/LockReset";

// /customer/reset-password — public (that's the point — the customer is locked out).
// Proves identity via the OTP just emailed (via /customer/forgot-password), not a password.
export default function CustomerResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillEmail = (location.state as { email?: string } | null)?.email || "";

  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/customer/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Reset failed: ${res.status}`);

      navigate("/customer/login", { state: { email }, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
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
            <Typography variant="h5">Reset password</Typography>
          </Stack>

          <Stack component="form" onSubmit={handleSubmit} spacing={2}>
            <TextField
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoFocus={!prefillEmail}
            />
            <TextField
              label="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              fullWidth
              autoFocus={!!prefillEmail}
              inputProps={{ maxLength: 6, inputMode: "numeric" }}
            />
            <TextField
              type="password"
              label="New password"
              helperText="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              fullWidth
            />
            <TextField
              type="password"
              label="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              fullWidth
            />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? "Resetting…" : "Reset password"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
