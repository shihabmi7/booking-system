import { FormEvent, useState } from "react";
import { useCustomerAuthFetch } from "../../auth/useCustomerAuthFetch";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";

// /customer/account/security — change password. Requires re-entering the current password,
// same principle as the backend enforces (see interview-prep-backend.md's Change Password Q&A)
// — a valid session token alone isn't enough to change it.
export default function CustomerSecurityPage() {
  const customerAuthFetch = useCustomerAuthFetch();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await customerAuthFetch("/api/customer/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Change failed: ${res.status}`);
      setSuccess(body.message || "Password changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Change failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Stack spacing={3} sx={{ maxWidth: 420 }}>
          <Typography variant="h6">Change password</Typography>
          <Stack component="form" onSubmit={handleSubmit} spacing={2}>
            <TextField
              type="password"
              label="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              fullWidth
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
            {success && <Alert severity="success">{success}</Alert>}
            <Button type="submit" variant="contained" disabled={submitting} sx={{ alignSelf: "flex-start" }}>
              {submitting ? "Changing…" : "Change password"}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
