import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  dbConnected: boolean;
  timestamp: string;
};

// Same health-check page from Phase 1, just moved into its own route now that
// the app has more than one page.
export default function HomePage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setHealth)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <h1>Booking System</h1>
      <p>Phase 2 — backend schema + frontend routing.</p>

      {error && <p style={{ color: "crimson" }}>Backend not reachable: {error}</p>}

      {!error && !health && <p>Checking backend connection…</p>}

      {health && (
        <ul>
          <li>API status: {health.status}</li>
          <li>Database connected: {health.dbConnected ? "yes" : "no"}</li>
          <li>Server time: {health.timestamp}</li>
        </ul>
      )}
    </div>
  );
}
