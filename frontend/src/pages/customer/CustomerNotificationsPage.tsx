import { useCallback, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useCustomerAuthFetch } from "../../auth/useCustomerAuthFetch";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Link from "@mui/material/Link";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  bookingId: string | null;
  booking: { bookingRef: string; startTime: string; status: string } | null;
};

type ListResponse = { items: NotificationItem[]; nextCursor: string | null };

// Same wording style as notificationTemplates.ts on the backend — a short human label per
// system NotificationType, plus a fallback for anything unrecognized (defensive: a future
// enum value shouldn't blank out the whole chip).
const TYPE_LABEL: Record<string, string> = {
  BOOKING_CONFIRMED: "Booking confirmed",
  BOOKING_REMINDER: "Reminder",
  CHECK_IN_CONFIRMED: "Checked in",
  BOOKING_CANCELLED: "Cancelled",
  BOOKING_RESCHEDULED: "Rescheduled",
  STAFF_MESSAGE: "Message",
};

// /customer/notifications — the full, paginated notification history. The AppBar bell (see
// components/NotificationBell.tsx) covers "what's new since I last looked"; this page is
// where "show me everything" lives, same relationship CustomerBookingsPage has to a
// hypothetical booking-summary widget elsewhere.
export default function CustomerNotificationsPage() {
  const customerAuthFetch = useCustomerAuthFetch();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const loadFirstPage = useCallback(
    (unread: boolean) => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ limit: "20", ...(unread ? { unreadOnly: "true" } : {}) });
      customerAuthFetch(`/api/notifications?${params}`)
        .then((res) => res.json())
        .then((data: ListResponse) => {
          setItems(data.items);
          setNextCursor(data.nextCursor);
          setLoadedOnce(true);
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load notifications"))
        .finally(() => setLoading(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    loadFirstPage(unreadOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadOnly]);

  function loadMore() {
    if (!nextCursor) return;
    setLoading(true);
    const params = new URLSearchParams({
      limit: "20",
      cursor: nextCursor,
      ...(unreadOnly ? { unreadOnly: "true" } : {}),
    });
    customerAuthFetch(`/api/notifications?${params}`)
      .then((res) => res.json())
      .then((data: ListResponse) => {
        setItems((prev) => [...prev, ...data.items]);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load more"))
      .finally(() => setLoading(false));
  }

  async function markRead(item: NotificationItem) {
    if (item.readAt) return;
    // Optimistic — the endpoint is idempotent (POST /:id/read on an already-read row still
    // succeeds), so there's nothing to roll back if this races with anything else.
    setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
    try {
      await customerAuthFetch(`/api/notifications/${item.id}/read`, { method: "POST" });
    } catch {
      // Non-fatal — worst case the badge count is one off until the next poll corrects it.
    }
  }

  async function markAllRead() {
    try {
      await customerAuthFetch("/api/notifications/read-all", { method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark all as read");
    }
  }

  const hasUnread = items.some((n) => !n.readAt);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={2}>
        <Typography variant="h4">Notifications</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <ToggleButtonGroup
            size="small"
            exclusive
            value={unreadOnly ? "unread" : "all"}
            onChange={(_, next) => next && setUnreadOnly(next === "unread")}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="unread">Unread</ToggleButton>
          </ToggleButtonGroup>
          <Button size="small" onClick={markAllRead} disabled={!hasUnread}>
            Mark all as read
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error">{error}</Alert>}

      {loadedOnce && items.length === 0 && !loading && (
        <Alert severity="info">{unreadOnly ? "No unread notifications." : "No notifications yet."}</Alert>
      )}

      {items.length > 0 && (
        <Paper variant="outlined">
          <List disablePadding>
            {items.map((item, i) => (
              <Box key={item.id}>
                {i > 0 && <Divider component="li" />}
                <ListItemButton
                  alignItems="flex-start"
                  onClick={() => markRead(item)}
                  sx={{ bgcolor: item.readAt ? "transparent" : "action.hover" }}
                >
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography component="span" sx={{ fontWeight: item.readAt ? 400 : 700 }}>
                          {item.title}
                        </Typography>
                        <Chip size="small" label={TYPE_LABEL[item.type] ?? item.type} variant="outlined" />
                        {!item.readAt && <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />}
                      </Stack>
                    }
                    secondary={
                      <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          {item.body}
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            {new Date(item.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                          </Typography>
                          {item.booking && (
                            <Link
                              component={RouterLink}
                              to={`/bookings/${item.booking.bookingRef}`}
                              variant="caption"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View booking
                            </Link>
                          )}
                        </Stack>
                      </Stack>
                    }
                  />
                </ListItemButton>
              </Box>
            ))}
          </List>
        </Paper>
      )}

      {loading && (
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
          <CircularProgress size={18} />
          <Typography variant="body2" color="text.secondary">
            Loading…
          </Typography>
        </Stack>
      )}

      {!loading && nextCursor && (
        <Button variant="outlined" onClick={loadMore} sx={{ alignSelf: "center" }}>
          Load more
        </Button>
      )}
    </Stack>
  );
}
