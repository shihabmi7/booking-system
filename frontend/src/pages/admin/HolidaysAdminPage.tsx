import { FormEvent, useEffect, useState } from "react";
import { useAuthFetch } from "../../auth/useAuthFetch";

type Holiday = { id: string; date: string; reason: string | null };

// Admin-only: add and remove one-off closed dates for the logged-in admin's own business.
// GET/POST/DELETE all scope to req.user.businessId on the backend — there's no businessId
// field in this form at all, matching how the API ignores any businessId sent in the body.
export default function HolidaysAdminPage() {
  const authFetch = useAuthFetch();

  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadHolidays() {
    authFetch("/api/holidays")
      .then((res) => res.json())
      .then(setHolidays)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load holidays"));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadHolidays, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!date) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("/api/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, reason: reason.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      setDate("");
      setReason("");
      loadHolidays();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add holiday");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Remove this holiday?")) return;
    setError(null);
    try {
      const res = await authFetch(`/api/holidays/${id}`, { method: "DELETE" });
      if (res.status === 204) {
        loadHolidays();
        return;
      }
      const body = await res.json();
      throw new Error(body.error || `Request failed: ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete holiday");
    }
  }

  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", alignItems: "end" }}>
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ display: "block", padding: "0.4rem" }}
          />
        </label>
        <label>
          Reason (optional)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{ display: "block", padding: "0.4rem" }}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add holiday"}
        </button>
      </form>

      {holidays && holidays.length === 0 && <p>No holidays set.</p>}

      {holidays && holidays.length > 0 && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>Date</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {holidays.map((h) => (
              <tr key={h.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{h.date.slice(0, 10)}</td>
                <td>{h.reason || "—"}</td>
                <td>
                  <button type="button" onClick={() => handleDelete(h.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
