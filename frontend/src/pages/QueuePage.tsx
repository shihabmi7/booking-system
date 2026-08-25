import { useEffect, useState } from "react";
import { useAuthFetch } from "../auth/useAuthFetch";

type Resource = {
  id: string;
  name: string;
  business: { name: string };
};

type QueueEntry = {
  bookingRef: string;
  customerName: string;
  status: string;
  startTime: string;
  isLate: boolean;
  service: { name: string; durationMins: number };
};

// The front-desk view: pick a resource + date, see everyone booked for that day in order,
// with inline actions to move each booking through the state machine (check in / no-show /
// complete) without leaving the page.
export default function QueuePage() {
  const authFetch = useAuthFetch();
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/api/resources")
      .then((res) => res.json())
      .then((data: Resource[]) => {
        setResources(data);
        if (data.length > 0) setResourceId(data[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load resources"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshQueue() {
    if (!resourceId) return;
    const params = new URLSearchParams({ resourceId, date });
    authFetch(`/api/queue?${params}`)
      .then((res) => res.json())
      .then(setQueue)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load queue"));
  }

  useEffect(refreshQueue, [resourceId, date]);

  async function runAction(bookingRef: string, action: "checkin" | "no-show" | "complete") {
    setActionError(null);
    try {
      const res = await authFetch(`/api/bookings/${bookingRef}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "checkin" ? JSON.stringify({ method: "manual" }) : undefined,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      refreshQueue();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <div>
      <h1>Queue</h1>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {actionError && <p style={{ color: "crimson" }}>{actionError}</p>}

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <label>
          Resource
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            style={{ display: "block", marginTop: "0.25rem" }}
          >
            {resources?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.business.name})
              </option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ display: "block", marginTop: "0.25rem" }}
          />
        </label>
      </div>

      {queue && queue.length === 0 && <p>No bookings for this resource on this date.</p>}

      {queue && queue.length > 0 && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>Time</th>
              <th>Customer</th>
              <th>Service</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((entry) => (
              <tr key={entry.bookingRef} style={{ borderBottom: "1px solid #eee" }}>
                <td>
                  {new Date(entry.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </td>
                <td>{entry.customerName}</td>
                <td>{entry.service.name}</td>
                <td>
                  {entry.status}
                  {entry.isLate && <span style={{ color: "#a05a00" }}> (late)</span>}
                </td>
                <td style={{ display: "flex", gap: "0.5rem" }}>
                  {entry.status === "BOOKED" && (
                    <>
                      <button type="button" onClick={() => runAction(entry.bookingRef, "checkin")}>
                        Check In
                      </button>
                      <button type="button" onClick={() => runAction(entry.bookingRef, "no-show")}>
                        No-Show
                      </button>
                    </>
                  )}
                  {entry.status === "CHECKED_IN" && (
                    <button type="button" onClick={() => runAction(entry.bookingRef, "complete")}>
                      Complete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
