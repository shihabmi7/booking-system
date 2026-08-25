import { FormEvent, useEffect, useState } from "react";
import { useAuthFetch } from "../../auth/useAuthFetch";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

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
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack
            component="form"
            onSubmit={handleAdd}
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ sm: "center" }}
          >
            <TextField
              type="date"
              label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Reason (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={submitting} sx={{ whiteSpace: "nowrap" }}>
              {submitting ? "Adding…" : "Add holiday"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {holidays && holidays.length === 0 && <Alert severity="info">No holidays set.</Alert>}

      {holidays && holidays.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Reason</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {holidays.map((h) => (
                <TableRow key={h.id} hover>
                  <TableCell>{h.date.slice(0, 10)}</TableCell>
                  <TableCell>{h.reason || "—"}</TableCell>
                  <TableCell>
                    <Button size="small" color="error" onClick={() => handleDelete(h.id)}>
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Stack>
  );
}
