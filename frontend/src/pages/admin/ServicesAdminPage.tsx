import { FormEvent, useEffect, useState } from "react";
import { useAuthFetch } from "../../auth/useAuthFetch";

type Resource = { id: string; name: string };

// resourceId is a plain scalar field on Service, returned alongside the nested `resource`
// relation whenever the API uses Prisma's `include` — that's what lets this page match each
// service back to one of the admin's own resources without the backend needing a new endpoint.
type Service = {
  id: string;
  name: string;
  durationMins: number;
  price: string;
  resourceId: string;
  resource: { name: string };
};

// Admin-only: add, edit, and remove services. GET /api/services is public and returns every
// business's services, so this page filters to just the ones attached to a resource the admin
// actually owns — the real enforcement is server-side (POST/PATCH/DELETE all check ownership
// and reject anything else with 403/404), this filtering is purely about what to show.
export default function ServicesAdminPage() {
  const authFetch = useAuthFetch();

  const [resources, setResources] = useState<Resource[] | null>(null);
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [resourceId, setResourceId] = useState("");
  const [name, setName] = useState("");
  const [durationMins, setDurationMins] = useState("30");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editPrice, setEditPrice] = useState("");

  function loadAll() {
    authFetch("/api/resources")
      .then((res) => res.json())
      .then((data: Resource[]) => {
        setResources(data);
        if (!resourceId && data.length > 0) setResourceId(data[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load resources"));

    authFetch("/api/services")
      .then((res) => res.json())
      .then(setServices)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load services"));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(loadAll, []);

  const ownResourceIds = new Set((resources || []).map((r) => r.id));
  const ownServices = (services || []).filter((s) => ownResourceIds.has(s.resourceId));

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!resourceId || !name.trim() || !price) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId,
          name: name.trim(),
          durationMins: Number(durationMins),
          price: Number(price),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      setName("");
      setPrice("");
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add service");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(service: Service) {
    setEditingId(service.id);
    setEditName(service.name);
    setEditDuration(String(service.durationMins));
    setEditPrice(service.price);
  }

  async function saveEdit(id: string) {
    setError(null);
    try {
      const res = await authFetch(`/api/services/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          durationMins: Number(editDuration),
          price: Number(editPrice),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      setEditingId(null);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update service");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this service?")) return;
    setError(null);
    try {
      const res = await authFetch(`/api/services/${id}`, { method: "DELETE" });
      if (res.status === 204) {
        loadAll();
        return;
      }
      const body = await res.json();
      throw new Error(body.error || `Request failed: ${res.status}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete service");
    }
  }

  return (
    <div>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <form onSubmit={handleAdd} style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", alignItems: "end" }}>
        <label>
          Resource
          <select
            value={resourceId}
            onChange={(e) => setResourceId(e.target.value)}
            style={{ display: "block", padding: "0.4rem" }}
          >
            {resources?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: "block", padding: "0.4rem" }} />
        </label>
        <label>
          Duration (min)
          <input
            type="number"
            min="1"
            value={durationMins}
            onChange={(e) => setDurationMins(e.target.value)}
            style={{ display: "block", padding: "0.4rem", width: "6rem" }}
          />
        </label>
        <label>
          Price
          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={{ display: "block", padding: "0.4rem", width: "6rem" }}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add service"}
        </button>
      </form>

      {ownServices.length === 0 && <p>No services yet.</p>}

      {ownServices.length > 0 && (
        <table cellPadding={8} style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>Name</th>
              <th>Duration</th>
              <th>Price</th>
              <th>Resource</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {ownServices.map((service) =>
              editingId === service.id ? (
                <tr key={service.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="1"
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      style={{ width: "5rem" }}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      style={{ width: "5rem" }}
                    />
                  </td>
                  <td>{service.resource.name}</td>
                  <td style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => saveEdit(service.id)}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={service.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{service.name}</td>
                  <td>{service.durationMins} min</td>
                  <td>${service.price}</td>
                  <td>{service.resource.name}</td>
                  <td style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => startEdit(service)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => handleDelete(service.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
