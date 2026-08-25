import { useEffect, useState } from "react";
import { useAuthFetch } from "../../auth/useAuthFetch";

type Resource = {
  id: string;
  name: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  closedWeekdays: number[];
};

const WEEKDAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

// Admin-only: edit a resource's daily working hours and which weekdays it's closed every
// week. Both feed directly into services/availability.ts on the backend — this is the only
// screen that changes what a customer sees on the /book slot picker without touching a
// single booking directly.
export default function HoursAdminPage() {
  const authFetch = useAuthFetch();

  const [resources, setResources] = useState<Resource[] | null>(null);
  const [resourceId, setResourceId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function loadResources(selectId?: string) {
    authFetch("/api/resources")
      .then((res) => res.json())
      .then((data: Resource[]) => {
        setResources(data);
        const target = data.find((r) => r.id === selectId) || data[0];
        if (target) selectResource(target);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load resources"));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => loadResources(), []);

  function selectResource(r: Resource) {
    setResourceId(r.id);
    setStart(r.workingHoursStart);
    setEnd(r.workingHoursEnd);
    setClosedWeekdays(r.closedWeekdays);
  }

  function handleResourceChange(id: string) {
    const r = resources?.find((res) => res.id === id);
    if (r) selectResource(r);
  }

  function toggleWeekday(value: number) {
    setClosedWeekdays((prev) => (prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]));
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const res = await authFetch(`/api/resources/${resourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workingHoursStart: start, workingHoursEnd: end, closedWeekdays }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      setSuccess("Saved.");
      loadResources(resourceId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save hours");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {success && <p style={{ color: "#0f6e56" }}>{success}</p>}

      <label>
        Resource
        <select
          value={resourceId}
          onChange={(e) => handleResourceChange(e.target.value)}
          style={{ display: "block", padding: "0.4rem", marginBottom: "1rem" }}
        >
          {resources?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <label>
          Opens
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ display: "block", padding: "0.4rem" }} />
        </label>
        <label>
          Closes
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ display: "block", padding: "0.4rem" }} />
        </label>
      </div>

      <p style={{ marginBottom: "0.25rem" }}>Closed every week on:</p>
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
        {WEEKDAYS.map((day) => (
          <label key={day.value} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <input
              type="checkbox"
              checked={closedWeekdays.includes(day.value)}
              onChange={() => toggleWeekday(day.value)}
            />
            {day.label}
          </label>
        ))}
      </div>

      <button type="button" onClick={handleSave} disabled={saving || !resourceId}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
