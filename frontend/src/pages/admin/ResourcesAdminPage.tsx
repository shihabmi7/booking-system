import { FormEvent, useEffect, useState } from "react";
import { useAuthFetch } from "../../auth/useAuthFetch";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
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
import Chip from "@mui/material/Chip";

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
    <Stack spacing={3}>
      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack component="form" onSubmit={handleAdd} direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Jane Kim"
              fullWidth
            />
            <Button type="submit" variant="contained" disabled={submitting} sx={{ whiteSpace: "nowrap" }}>
              {submitting ? "Adding…" : "Add resource"}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
            New resources start with default hours (9:00-17:00, no closed days) — adjust those on the Hours tab.
          </Typography>
        </CardContent>
      </Card>

      {resources && resources.length === 0 && <Alert severity="info">No resources yet.</Alert>}

      {resources && resources.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Closed weekly</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resources.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{r.name}</TableCell>
                  <TableCell>
                    {r.workingHoursStart} – {r.workingHoursEnd}
                  </TableCell>
                  <TableCell>
                    {r.closedWeekdays.length > 0 ? (
                      <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                        {r.closedWeekdays.map((d) => (
                          <Chip key={d} size="small" label={WEEKDAY_LABELS[d]} />
                        ))}
                      </Stack>
                    ) : (
                      "—"
                    )}
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
