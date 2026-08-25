import { FormEvent, useEffect, useState } from "react";
import { useAuthFetch } from "../../auth/useAuthFetch";

type Resource = {
  id: string;
  name: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  closedWeekdays: number[];
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Admin-only: create a new resource (doctor/stylist/chair). Working hours default to the
// schema's own @default (09:00-17:00, no closed days) if left blank — editing those later,
// or a resource's weekly closed days, happens on the Hours tab, not here. Keeping "create"
// and "edit hours" as separate screens mirrors how the backend split them into POST vs PATCH.
export default function ResourcesAdminPage() {
  const authFetch = useAuthFetch();

  const [resources, setResources] = useState<Resource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadResources() {
    authFetch("/api/resources")
      .then((res) => res.json())
      .then(setResources)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load resources"));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadResources, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      setName("");
      loadResources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add resource");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", alignItems: "end" }}>
        <label>
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Dr. Jane Kim"
            style={{ display: "block", padding: "0.4rem" }}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add resource"}
        </button>
      </form>
      <p style={{ fontSize: "0.85rem", color: "#666", marginTop: "-1rem", marginBottom: "1.5rem" }}>
        New resources start with default hours (9:00-17:00, no closed days) — adjust those on the
        Hours tab.
      </p>

      {resources && resources.length === 0 && <p>No resources yet.</p>}

      {resources && resources.length > 0 && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>Name</th>
              <th>Hours</th>
              <th>Closed weekly</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{r.name}</td>
                <td>
                  {r.workingHoursStart} – {r.workingHoursEnd}
                </td>
                <td>
                  {r.closedWeekdays.length > 0
                    ? r.closedWeekdays.map((d) => WEEKDAY_LABELS[d]).join(", ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
