import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

// Staff/admin login. Not customer-facing — customers never see this page, they interact
// entirely through /book and /bookings/:bookingRef without ever logging in.
export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      // Send the user back to the page they were trying to reach (set by RequireAuth),
      // or default to the queue view if they came here directly.
      const redirectTo = (location.state as { from?: string } | null)?.from || "/queue";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 320 }}>
      <h1>Staff Login</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.25rem" }}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: "block", width: "100%", padding: "0.4rem", marginTop: "0.25rem" }}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log In"}
        </button>
      </form>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <p style={{ marginTop: "1.5rem", fontSize: "0.85rem", color: "#666" }}>
        Sample accounts from the seed script: <br />
        admin@sunriseclinic.test / AdminPass123! <br />
        staff@sunriseclinic.test / StaffPass123!
      </p>
    </div>
  );
}
