import { FormEvent, useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../../auth/CustomerAuthContext";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";

// /customer/login — public, fully separate from /staff/login (see
// auth/CustomerAuthContext.tsx). Same "from" redirect pattern as StaffLoginPage: a customer
// who got bounced here from a guarded page like /book lands back there after logging in.
export default function CustomerLoginPage() {
  const { login } = useCustomerAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from || "/", { replace: true });
    } catch (err) {
      const e2 = err as Error & { unverified?: boolean };
      setError(e2.message || "Login failed");
      setUnverified(!!e2.unverified);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: { xs: 2, md: 6 } }}>
      <Card sx={{ width: "100%", maxWidth: 380 }}>
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
              <PersonOutlineIcon />
            </Box>
            <Typography variant="h5">Log in</Typography>
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
            <TextField
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
            />
            {error && (
              <Alert severity={unverified ? "warning" : "error"}>
                {error}
                {unverified && (
                  <>
                    {" "}
                    <Link
                      component={RouterLink}
                      to="/customer/verify"
                      state={{ email, from }}
                    >
                      Verify now
                    </Link>
                  </>
                )}
              </Alert>
            )}
            <Button type="submit" variant="contained" size="large" disabled={submitting}>
              {submitting ? "Logging in…" : "Log in"}
            </Button>
          </Stack>

          <Stack spacing={1} sx={{ mt: 3 }}>
            <Typography variant="body2" align="center">
              <Link component={RouterLink} to="/customer/forgot-password" state={{ email }}>
                Forgot password?
              </Link>
            </Typography>
            <Typography variant="body2" align="center">
              New here?{" "}
              <Link component={RouterLink} to="/customer/register" state={{ from }}>
                Create an account
              </Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
