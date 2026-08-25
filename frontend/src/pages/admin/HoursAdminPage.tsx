import { useEffect, useState } from "react";
import { useAuthFetch } from "../../auth/useAuthFetch";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";

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
    <Stack spacing={3} sx={{ maxWidth: 560 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      <Card>
        <CardContent>
          <Stack spacing={3}>
            <TextField select label="Resource" value={resourceId} onChange={(e) => handleResourceChange(e.target.value)} fullWidth>
              {resources?.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                type="time"
                label="Opens"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                type="time"
                label="Closes"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>

            <Stack spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Closed every week on
              </Typography>
              <ToggleButtonGroup
                value={closedWeekdays}
                onChange={(_e, next: number[]) => setClosedWeekdays(next)}
                size="small"
              >
                {WEEKDAYS.map((day) => (
                  <ToggleButton key={day.value} value={day.value}>
                    {day.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>

            <Button variant="contained" onClick={handleSave} disabled={saving || !resourceId} sx={{ alignSelf: "flex-start" }}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
