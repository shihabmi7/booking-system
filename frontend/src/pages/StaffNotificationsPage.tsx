import { FormEvent, useEffect, useState } from "react";
import { useAuthFetch } from "../auth/useAuthFetch";
import { useAuth } from "../auth/AuthContext";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Paper from "@mui/material/Paper";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Box from "@mui/material/Box";

type CustomerSearchResult = { id: string; name: string; email: string; phone: string | null };

type SendResult = { customerId: string; sent: boolean; pushed: number; failed: number };

type SentNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string };
  sentByUser: { id: string; email: string } | null;
  _count: { deliveries: number };
};

const MAX_TITLE = 80;
const MAX_BODY = 400;

// /staff/notifications — reachable by STAFF and ADMIN alike (RequireAuth on the route has no
// role= prop, matching the backend's requireRole(STAFF, ADMIN) on both endpoints this page
// calls). Two local tabs rather than two routes: composing and reviewing what's already gone
// out are the same task ("manage what customers are being told"), not two different pages a
// user would deep-link to separately — same reasoning AdminLayout/CustomerAccountLayout use
// for their own tab bars, just kept as component-local state here since there's nothing else
// under /staff/notifications/* that would need its own URL.
export default function StaffNotificationsPage() {
  const authFetch = useAuthFetch();
  const { user } = useAuth();
  const [tab, setTab] = useState<"compose" | "sent">("compose");

  // --- Compose ---
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [recipients, setRecipients] = useState<CustomerSearchResult[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResults, setSendResults] = useState<SendResult[] | null>(null);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      authFetch(`/api/staff/customers?search=${encodeURIComponent(searchQuery)}`)
        .then((res) => res.json())
        .then((data: CustomerSearchResult[]) => setSearchResults(data.filter((c) => !recipients.some((r) => r.id === c.id))))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, recipients]);

  function addRecipient(c: CustomerSearchResult) {
    setRecipients((prev) => [...prev, c]);
    setSearchQuery("");
    setSearchResults([]);
  }

  function removeRecipient(id: string) {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (recipients.length === 0 || !title.trim() || !body.trim()) return;

    setSending(true);
    setSendError(null);
    setSendResults(null);
    try {
      const res = await authFetch("/api/staff/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerIds: recipients.map((r) => r.id),
          title: title.trim(),
          body: body.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
      setSendResults(data.results);
      setRecipients([]);
      setTitle("");
      setBody("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  // --- Sent history ---
  const [sent, setSent] = useState<SentNotification[] | null>(null);
  const [sentError, setSentError] = useState<string | null>(null);

  function loadSent() {
    setSentError(null);
    authFetch("/api/staff/notifications/sent?limit=50")
      .then((res) => res.json())
      .then(setSent)
      .catch((err) => setSentError(err instanceof Error ? err.message : "Failed to load sent notifications"));
  }

  useEffect(() => {
    if (tab === "sent" && sent === null) loadSent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Notifications</Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Send a message" value="compose" />
          <Tab label="Sent history" value="sent" />
        </Tabs>
      </Box>

      {tab === "compose" && (
        <Card>
          <CardContent>
            <Stack component="form" onSubmit={handleSend} spacing={2.5} sx={{ maxWidth: 560 }}>
              <Stack spacing={1}>
                <Typography variant="body2" color="text.secondary">
                  Recipients
                </Typography>
                {recipients.length > 0 && (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    {recipients.map((r) => (
                      <Chip key={r.id} label={r.name} onDelete={() => removeRecipient(r.id)} color="primary" size="small" />
                    ))}
                  </Stack>
                )}
                <TextField
                  label="Search by name, email, or phone"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="small"
                  fullWidth
                />
                {searching && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">
                      Searching…
                    </Typography>
                  </Stack>
                )}
                {!searching && searchResults.length > 0 && (
                  <Paper variant="outlined">
                    <List disablePadding dense>
                      {searchResults.map((c) => (
                        <ListItemButton key={c.id} onClick={() => addRecipient(c)}>
                          <ListItemText primary={c.name} secondary={`${c.email}${c.phone ? ` · ${c.phone}` : ""}`} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Paper>
                )}
              </Stack>

              <TextField
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                inputProps={{ maxLength: MAX_TITLE }}
                helperText={`${title.length}/${MAX_TITLE}`}
                fullWidth
              />
              <TextField
                label="Message"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                inputProps={{ maxLength: MAX_BODY }}
                helperText={`${body.length}/${MAX_BODY}`}
                multiline
                minRows={3}
                fullWidth
              />

              {sendError && <Alert severity="error">{sendError}</Alert>}
              {sendResults && (
                <Alert severity="success">
                  Sent to {sendResults.filter((r) => r.sent).length} of {sendResults.length} recipient(s).{" "}
                  {sendResults.some((r) => r.pushed === 0 && r.sent) &&
                    "Some recipients have no device registered — they'll still see it in-app."}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                disabled={sending || recipients.length === 0 || !title.trim() || !body.trim()}
                sx={{ alignSelf: "flex-start" }}
              >
                {sending ? "Sending…" : `Send to ${recipients.length || ""} recipient${recipients.length === 1 ? "" : "s"}`}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {tab === "sent" && (
        <Stack spacing={2}>
          {sentError && <Alert severity="error">{sentError}</Alert>}
          {sent && sent.length === 0 && <Alert severity="info">Nothing sent yet.</Alert>}
          {sent && sent.length > 0 && (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>Customer</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Sent by</TableCell>
                    <TableCell>Deliveries</TableCell>
                    <TableCell>Read</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sent.map((n) => (
                    <TableRow key={n.id} hover>
                      <TableCell>{new Date(n.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</TableCell>
                      <TableCell>
                        {n.customer.name}
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {n.customer.email}
                        </Typography>
                      </TableCell>
                      <TableCell>{n.title}</TableCell>
                      <TableCell>{n.sentByUser?.email ?? "System"}</TableCell>
                      <TableCell>{n._count.deliveries}</TableCell>
                      <TableCell>{n.readAt ? "Read" : "Unread"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {sent === null && !sentError && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2" color="text.secondary">
                Loading…
              </Typography>
            </Stack>
          )}
        </Stack>
      )}

      {user?.role === "ADMIN" && (
        <Alert severity="info" variant="outlined">
          Reminder timing, quiet hours, and which automated notifications are enabled live under{" "}
          <b>Admin → Notifications</b>.
        </Alert>
      )}
    </Stack>
  );
}
