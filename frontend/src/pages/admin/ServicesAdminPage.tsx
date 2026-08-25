import { FormEvent, useEffect, useState } from "react";
import { useAuthFetch } from "../../auth/useAuthFetch";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

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
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack
            component="form"
            onSubmit={handleAdd}
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ md: "center" }}
          >
            <TextField select label="Resource" value={resourceId} onChange={(e) => setResourceId(e.target.value)} sx={{ minWidth: 180 }}>
              {resources?.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
            <TextField
              type="number"
              label="Duration (min)"
              value={durationMins}
              onChange={(e) => setDurationMins(e.target.value)}
              sx={{ minWidth: 140 }}
              inputProps={{ min: 1 }}
            />
            <TextField
              type="number"
              label="Price"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              sx={{ minWidth: 120 }}
              inputProps={{ min: 0, step: 0.01 }}
            />
            <Button type="submit" variant="contained" disabled={submitting} sx={{ whiteSpace: "nowrap" }}>
              {submitting ? "Adding…" : "Add service"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {ownServices.length === 0 && <Alert severity="info">No services yet.</Alert>}

      {ownServices.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Resource</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ownServices.map((service) =>
                editingId === service.id ? (
                  <TableRow key={service.id}>
                    <TableCell>
                      <TextField size="small" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        sx={{ width: 90 }}
                        inputProps={{ min: 1 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        sx={{ width: 90 }}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </TableCell>
                    <TableCell>{service.resource.name}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" variant="contained" onClick={() => saveEdit(service.id)}>
                          Save
                        </Button>
                        <Button size="small" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={service.id} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{service.name}</TableCell>
                    <TableCell>{service.durationMins} min</TableCell>
                    <TableCell>${service.price}</TableCell>
                    <TableCell>{service.resource.name}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
                        <Button size="small" onClick={() => startEdit(service)}>
                          Edit
                        </Button>
                        <Button size="small" color="error" onClick={() => handleDelete(service.id)}>
                          Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
