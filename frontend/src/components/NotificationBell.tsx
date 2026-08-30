import { useCallback, useEffect, useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useCustomerAuth } from "../auth/CustomerAuthContext";
import { useCustomerAuthFetch } from "../auth/useCustomerAuthFetch";
import IconButton from "@mui/material/IconButton";
import Badge from "@mui/material/Badge";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import NotificationsIcon from "@mui/icons-material/Notifications";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  booking: { bookingRef: string } | null;
};

const POLL_MS = 30_000;
const PREVIEW_LIMIT = 6;

// AppBar bell for a logged-in customer — mirrors the "unread badge + dropdown preview + view
// all" pattern most consumer apps use. Only rendered while a customer session exists (App.tsx
// guards this), same as the customer identity slot next to it.
//
// Polls the dedicated unread-count endpoint rather than the full list every 30s — that
// endpoint is a cheap COUNT on an index (see routes/notifications.ts) specifically so a
// badge like this one can be polled without loading full notification rows on every tick.
export default function NotificationBell() {
  const { customer } = useCustomerAuth();
  const customerAuthFetch = useCustomerAuthFetch();
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [count, setCount] = useState(0);
  const [preview, setPreview] = useState<NotificationItem[] | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshCount = useCallback(() => {
    customerAuthFetch("/api/notifications/unread-count")
      .then((res) => res.json())
      .then((data: { count: number }) => setCount(data.count))
      .catch(() => {
        /* a missed poll just means a stale badge until the next tick — not worth surfacing */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!customer) return;
    refreshCount();
    pollRef.current = setInterval(refreshCount, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [customer, refreshCount]);

  if (!customer) return null;

  function openMenu(e: React.MouseEvent<HTMLElement>) {
    setAnchorEl(e.currentTarget);
    customerAuthFetch(`/api/notifications?limit=${PREVIEW_LIMIT}`)
      .then((res) => res.json())
      .then((data: { items: NotificationItem[] }) => setPreview(data.items))
      .catch(() => setPreview([]));
  }

  function closeMenu() {
    setAnchorEl(null);
  }

  async function handleItemClick(item: NotificationItem) {
    closeMenu();
    if (!item.readAt) {
      setCount((c) => Math.max(0, c - 1));
      customerAuthFetch(`/api/notifications/${item.id}/read`, { method: "POST" }).catch(() => {});
    }
    if (item.booking) navigate(`/bookings/${item.booking.bookingRef}`);
    else navigate("/customer/notifications");
  }

  async function markAllRead() {
    setCount(0);
    setPreview((prev) => prev?.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })) ?? null);
    try {
      await customerAuthFetch("/api/notifications/read-all", { method: "POST" });
    } catch {
      refreshCount();
    }
  }

  return (
    <>
      <IconButton color="inherit" onClick={openMenu} aria-label="Notifications" sx={{ ml: 1 }}>
        <Badge badgeContent={count} color="secondary" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={closeMenu} PaperProps={{ sx: { width: 360, maxWidth: "90vw" } }}>
        <Box sx={{ px: 2, py: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2">Notifications</Typography>
          {count > 0 && (
            <Button size="small" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        {preview === null && (
          <MenuItem disabled>
            <ListItemText primary="Loading…" />
          </MenuItem>
        )}
        {preview !== null && preview.length === 0 && (
          <MenuItem disabled>
            <ListItemText primary="You're all caught up." />
          </MenuItem>
        )}
        {preview?.map((item) => (
          <MenuItem key={item.id} onClick={() => handleItemClick(item)} sx={{ whiteSpace: "normal", alignItems: "flex-start" }}>
            <ListItemText
              primary={
                <Typography variant="body2" sx={{ fontWeight: item.readAt ? 400 : 700 }}>
                  {item.title}
                </Typography>
              }
              secondary={
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {item.body.length > 90 ? `${item.body.slice(0, 90)}…` : item.body}
                </Typography>
              }
            />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem component={RouterLink} to="/customer/notifications" onClick={closeMenu} sx={{ justifyContent: "center" }}>
          <Typography variant="body2" color="primary">
            View all
          </Typography>
        </MenuItem>
      </Menu>
    </>
  );
}
