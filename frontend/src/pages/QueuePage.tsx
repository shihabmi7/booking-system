import { useEffect, useState } from "react";
import { useAuthFetch } from "../auth/useAuthFetch";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import { ChipProps } from "@mui/material/Chip";

type Resource = {
  id: string;
  name: string;
  business: { name: string };
};

type QueueEntry = {
  bookingRef: string;
  customerName: string;
  status: string;
  startTime: string;
  isLate: boolean;
  service: { name: string; durationMins: number };
};

const STATUS_COLOR: Record<string, ChipProps["color"]> = {
  BOOKED: "primary",
  CHECKED_IN: "warning",
  COMPLETED: "success",
  NO_SHOW: "error",
  CANCELLED: "default",
};

// The front-desk view: pick a resource + date, see everyone booked for that day in order,
// with inline actions to move each booking through the state machine (check in / no-show /
// complete) without leaving the page.
export default function QueuePage() {
  const authFetch = useAuthFetch();
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [resourceId, setResourceId] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [queue, setQueue] = useState<QueueEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    authFetch("/api/resources")
      .then((res) => res.json())
      .then((data: Resource[]) => {
        setResources(data);
        if (data.length > 0) setResourceId(data[0].id);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load resources"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refreshQueue() {
    if (!resourceId) return;
    const params = new URLSearchParams({ resourceId, date });
    authFetch(`/api/queue?${params}`)
      .then((res) => res.json())
      .then(setQueue)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load queue"));
  }

  useEffect(refreshQueue, [resourceId, date]);

  async function runAction(bookingRef: string, action: "checkin" | "no-show" | "complete") {
    setActionError(null);
    try {
      const res = await authFetch(`/api/bookings/${bookingRef}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: action === "checkin" ? JSON.stringify({ method: "manual" }) : undefined,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
      refreshQueue();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Queue</Typography>

      {error && <Alert severity="error">{error}</Alert>}
      {actionError && <Alert severity="error">{actionError}</Alert>}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ maxWidth: 480 }}>
        <TextField
          select
          label="Resource"
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          fullWidth
        >
          {resources?.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.name} ({r.business.name})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          type="date"
          label="Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Stack>

      {queue && queue.length === 0 && <Alert severity="info">No bookings for this resource on this date.</Alert>}

      {queue && queue.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {queue.map((entry) => (
                <TableRow key={entry.bookingRef} hover>
                  <TableCell>
                    {new Date(entry.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell>{entry.customerName}</TableCell>
                  <TableCell>{entry.service.name}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Chip size="small" color={STATUS_COLOR[entry.status] ?? "default"} label={entry.status} />
                      {entry.isLate && <Chip size="small" color="warning" variant="outlined" label="late" />}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      {entry.status === "BOOKED" && (
                        <>
                          <Button size="small" variant="contained" onClick={() => runAction(entry.bookingRef, "checkin")}>
                            Check in
                          </Button>
                          <Button size="small" variant="outlined" color="error" onClick={() => runAction(entry.bookingRef, "no-show")}>
                            No-show
                          </Button>
                        </>
                      )}
                      {entry.status === "CHECKED_IN" && (
                        <Button size="small" variant="contained" color="success" onClick={() => runAction(entry.bookingRef, "complete")}>
                          Complete
                        </Button>
                      )}
                    </Stack>
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
