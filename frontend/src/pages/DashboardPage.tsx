import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useAuthFetch } from "../auth/useAuthFetch";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import LinearProgress from "@mui/material/LinearProgress";
import EventNoteIcon from "@mui/icons-material/EventNote";
import HowToRegIcon from "@mui/icons-material/HowToReg";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import PersonOffIcon from "@mui/icons-material/PersonOff";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import AddIcon from "@mui/icons-material/Add";

type Summary = {
  date: string;
  totals: {
    bookings: number;
    booked: number;
    checkedIn: number;
    completed: number;
    noShow: number;
    cancelled: number;
  };
  revenue: { expected: number; completed: number };
  nextUp: {
    bookingRef: string;
    customerName: string;
    startTime: string;
    service: { name: string };
    resource: { name: string };
  }[];
};

function KpiCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              bgcolor: color,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Stack>
            <Typography variant="h5" sx={{ lineHeight: 1.1 }}>
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// The business-level view a staff member or admin actually wants when they open the app:
// how many people are booked today, how many have already been seen, how many didn't show,
// and what today is worth so far — versus /queue, which is "one resource's line right now."
// Business-value reasoning behind each section is in interview-prep-frontend.md.
export default function DashboardPage() {
  const authFetch = useAuthFetch();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setSummary(null);
    setError(null);
    authFetch(`/api/dashboard/summary?date=${date}`)
      .then((res) => res.json())
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [date]);

  const completionRate =
    summary && summary.totals.bookings > 0
      ? Math.round((summary.totals.completed / summary.totals.bookings) * 100)
      : 0;

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Typography variant="h4">Dashboard</Typography>
        <TextField
          type="date"
          label="Date"
          size="small"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {!error && !summary && (
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} md={3} key={i}>
              <Skeleton variant="rounded" height={92} />
            </Grid>
          ))}
        </Grid>
      )}

      {summary && (
        <>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <KpiCard icon={<EventNoteIcon />} label="Booked today" value={summary.totals.bookings} color="#0f6e56" />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard icon={<HowToRegIcon />} label="Checked in" value={summary.totals.checkedIn} color="#b26a00" />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard icon={<TaskAltIcon />} label="Completed" value={summary.totals.completed} color="#2e7d32" />
            </Grid>
            <Grid item xs={6} md={3}>
              <KpiCard icon={<PersonOffIcon />} label="No-shows" value={summary.totals.noShow} color="#c62828" />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Revenue
                  </Typography>
                  <Stack spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography color="text.secondary">Completed</Typography>
                      <Typography sx={{ fontWeight: 500 }}>${summary.revenue.completed.toFixed(2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography color="text.secondary">Expected (booked + checked-in + completed)</Typography>
                      <Typography sx={{ fontWeight: 500 }}>${summary.revenue.expected.toFixed(2)}</Typography>
                    </Stack>
                  </Stack>
                  <Box sx={{ mt: 2 }}>
                    <LinearProgress
                      variant="determinate"
                      value={summary.revenue.expected > 0 ? (summary.revenue.completed / summary.revenue.expected) * 100 : 0}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      {completionRate}% of today's bookings completed
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card variant="outlined" sx={{ height: "100%" }}>
                <CardContent sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>
                    Quick actions
                  </Typography>
                  <Stack spacing={1.5} sx={{ flexGrow: 1, justifyContent: "center" }}>
                    <Button
                      component={RouterLink}
                      to="/staff/bookings/new"
                      variant="contained"
                      startIcon={<AddIcon />}
                      fullWidth
                    >
                      New booking
                    </Button>
                    <Button
                      component={RouterLink}
                      to="/queue"
                      variant="outlined"
                      startIcon={<PlaylistAddCheckIcon />}
                      fullWidth
                    >
                      Open queue
                    </Button>
                    <Button
                      component={RouterLink}
                      to="/checkin"
                      variant="outlined"
                      startIcon={<QrCodeScannerIcon />}
                      fullWidth
                    >
                      Manual check-in
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Next up
              </Typography>
              {summary.nextUp.length === 0 ? (
                <Typography color="text.secondary">No upcoming bookings left today.</Typography>
              ) : (
                <List disablePadding>
                  {summary.nextUp.map((b, i) => (
                    <Box key={b.bookingRef}>
                      {i > 0 && <Divider component="li" />}
                      <ListItem disablePadding sx={{ py: 1 }}>
                        <ListItemText
                          primary={`${new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — ${b.customerName}`}
                          secondary={`${b.service.name} · ${b.resource.name}`}
                        />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </Stack>
  );
}
