import { useEffect, useState } from "react";
import { useAuthFetch } from "../../auth/useAuthFetch";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";

type Settings = {
  reminderOffsetsMins: number[];
  remindersEnabled: boolean;
  checkInEnabled: boolean;
  bookingConfirmedEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

// Mirrors humanizeOffset() in backend/src/services/notificationTemplates.ts, so an admin sees
// the same "6 hours" / "90 minutes" phrasing here as customers see in the push itself.
function humanizeOffset(minutes: number): string {
  if (minutes % 60 !== 0) return `${minutes} min`;
  const hours = minutes / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

// /admin/notifications — ADMIN only (enforced by the /admin route's RequireAuth role="ADMIN"
// wrapper in App.tsx, same as every other tab under AdminLayout). Configures the reminder
// offsets, the automated-notification toggles, and quiet hours documented in
// push-notifications-plan.md — the "PATCH /api/staff/notifications/settings" endpoint this
// page is the only caller of.
export default function NotificationSettingsAdminPage() {
  const authFetch = useAuthFetch();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [newOffsetValue, setNewOffsetValue] = useState("1");
  const [newOffsetUnit, setNewOffsetUnit] = useState<"minutes" | "hours">("hours");
  const [quietEnabled, setQuietEnabled] = useState(false);
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");

  useEffect(() => {
    authFetch("/api/staff/notifications/settings")
      .then((res) => res.json())
      .then((data: Settings) => {
        setSettings(data);
        setQuietEnabled(!!data.quietHoursStart && !!data.quietHoursEnd);
        if (data.quietHoursStart) setQuietStart(data.quietHoursStart);
        if (data.quietHoursEnd) setQuietEnd(data.quietHoursEnd);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function patch(body: Partial<Settings>) {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await authFetch("/api/staff/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
      setSettings(data);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function toggle(field: keyof Settings, value: boolean) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    patch({ [field]: value });
  }

  function addOffset() {
    if (!settings) return;
    const n = Number(newOffsetValue);
    if (!Number.isInteger(n) || n <= 0) return;
    const minutes = newOffsetUnit === "hours" ? n * 60 : n;
    if (settings.reminderOffsetsMins.includes(minutes)) return;
    const next = [...settings.reminderOffsetsMins, minutes].sort((a, b) => b - a);
    setSettings({ ...settings, reminderOffsetsMins: next });
    patch({ reminderOffsetsMins: next });
  }

  function removeOffset(minutes: number) {
    if (!settings) return;
    const next = settings.reminderOffsetsMins.filter((m) => m !== minutes);
    setSettings({ ...settings, reminderOffsetsMins: next });
    patch({ reminderOffsetsMins: next });
  }

  function saveQuietHours() {
    if (quietEnabled) {
      patch({ quietHoursStart: quietStart, quietHoursEnd: quietEnd });
    } else {
      patch({ quietHoursStart: null, quietHoursEnd: null });
    }
  }

  if (!settings) {
    return (
      <Stack direction="row" spacing={1.5} alignItems="center">
        {error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={20} />}
      </Stack>
    );
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 640 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {saved && !error && <Alert severity="success" onClose={() => setSaved(false)}>Saved.</Alert>}

      <Card>
        <CardHeader title="Automated notifications" subheader="Turn each system-generated notification on or off for this business." />
        <CardContent>
          <Stack spacing={0.5}>
            <FormControlLabel
              control={<Switch checked={settings.bookingConfirmedEnabled} onChange={(e) => toggle("bookingConfirmedEnabled", e.target.checked)} />}
              label="Booking confirmation"
            />
            <FormControlLabel
              control={<Switch checked={settings.checkInEnabled} onChange={(e) => toggle("checkInEnabled", e.target.checked)} />}
              label="Check-in confirmation"
            />
            <FormControlLabel
              control={<Switch checked={settings.remindersEnabled} onChange={(e) => toggle("remindersEnabled", e.target.checked)} />}
              label="Appointment reminders"
            />
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Reminder timing"
          subheader="How long before an appointment each reminder fires. Applies only while reminders are enabled above."
        />
        <CardContent>
          <Stack spacing={2}>
            {settings.reminderOffsetsMins.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No reminders configured.
              </Typography>
            )}
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {settings.reminderOffsetsMins.map((m) => (
                <Chip key={m} label={humanizeOffset(m)} onDelete={() => removeOffset(m)} disabled={saving} />
              ))}
            </Stack>
            <Divider />
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TextField
                type="number"
                label="Value"
                size="small"
                value={newOffsetValue}
                onChange={(e) => setNewOffsetValue(e.target.value)}
                inputProps={{ min: 1 }}
                sx={{ width: 100 }}
              />
              <TextField
                select
                size="small"
                label="Unit"
                value={newOffsetUnit}
                onChange={(e) => setNewOffsetUnit(e.target.value as "minutes" | "hours")}
                SelectProps={{ native: true }}
                sx={{ width: 120 }}
              >
                <option value="minutes">minutes</option>
                <option value="hours">hours</option>
              </TextField>
              <Typography variant="body2" color="text.secondary">
                before the appointment
              </Typography>
              <Button variant="outlined" size="small" onClick={addOffset} disabled={saving}>
                Add
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="Quiet hours"
          subheader="Automated reminders are stored but not pushed during this window. Check-ins and staff messages always go through."
        />
        <CardContent>
          <Stack spacing={2}>
            <FormControlLabel
              control={<Switch checked={quietEnabled} onChange={(e) => setQuietEnabled(e.target.checked)} />}
              label="Enable quiet hours"
            />
            {quietEnabled && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  type="time"
                  label="Start"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  type="time"
                  label="End"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            )}
            <Button variant="contained" size="small" onClick={saveQuietHours} disabled={saving} sx={{ alignSelf: "flex-start" }}>
              {saving ? "Saving…" : "Save quiet hours"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
