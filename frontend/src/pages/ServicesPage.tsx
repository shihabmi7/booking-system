import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useCustomerAuthFetch } from "../auth/useCustomerAuthFetch";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";

// Shape returned by GET /api/services — mirrors the Prisma query in
// backend/src/routes/services.ts (service fields + nested resource + business name).
type Service = {
  id: string;
  name: string;
  durationMins: number;
  price: string; // Prisma Decimal serializes to a string over JSON
  resource: {
    name: string;
    business: {
      name: string;
    };
  };
};

// Proves the Phase 2 schema/migration/seed data all work by rendering real data
// from the database, instead of just a health-check ping.
export default function ServicesPage() {
  const customerAuthFetch = useCustomerAuthFetch();
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set of favorited service ids — a Set rather than an array so the per-row "is this
  // favorited" check in the table below is O(1) instead of an .includes() scan per row.
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setServices)
      .catch((err) => setError(err.message));

    // This page is wrapped in <RequireCustomerAuth> (see App.tsx), so a customer session
    // always exists here — no separate "logged in?" branch needed before loading favorites.
    customerAuthFetch("/api/favorites")
      .then((res) => res.json())
      .then((favs: { id: string }[]) => setFavoriteIds(new Set(favs.map((f) => f.id))))
      .catch(() => {
        /* favorites are a nice-to-have on this page — a failed load just leaves every heart
           outlined, which is a safe default, not worth surfacing as a page-level error */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleFavorite(serviceId: string) {
    const isFavorited = favoriteIds.has(serviceId);
    setPendingId(serviceId);
    // Optimistic — POST/DELETE here are both designed to be safe to retry (upsert / deleteMany
    // — see routes/favorites.ts), so there's nothing to roll back to on failure beyond
    // re-syncing the flag.
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      isFavorited ? next.delete(serviceId) : next.add(serviceId);
      return next;
    });
    try {
      if (isFavorited) {
        await customerAuthFetch(`/api/favorites/${serviceId}`, { method: "DELETE" });
      } else {
        await customerAuthFetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId }),
        });
      }
    } catch {
      // Revert on failure — flip it back to what it was before the optimistic update.
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        isFavorited ? next.add(serviceId) : next.delete(serviceId);
        return next;
      });
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Services</Typography>

      {error && <Alert severity="error">Failed to load services: {error}</Alert>}

      {!error && !services && <Skeleton variant="rounded" height={180} />}

      {services && services.length === 0 && <Alert severity="info">No services found — did you run "npm run seed"?</Alert>}

      {services && services.length > 0 && (
        // TableContainer scrolls horizontally on narrow screens instead of squeezing every
        // column — the same responsive pattern used for every table in this app (queue,
        // admin lists), so a phone-width viewport never forces text to wrap awkwardly.
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Service</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Business</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id} hover>
                  <TableCell padding="checkbox">
                    <IconButton
                      size="small"
                      aria-label={favoriteIds.has(service.id) ? "Remove from favorites" : "Add to favorites"}
                      disabled={pendingId === service.id}
                      onClick={() => toggleFavorite(service.id)}
                    >
                      {favoriteIds.has(service.id) ? (
                        <FavoriteIcon fontSize="small" color="error" />
                      ) : (
                        <FavoriteBorderIcon fontSize="small" />
                      )}
                    </IconButton>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{service.name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={`${service.durationMins} min`} />
                  </TableCell>
                  <TableCell>${service.price}</TableCell>
                  <TableCell>{service.resource.name}</TableCell>
                  <TableCell>{service.resource.business.name}</TableCell>
                  <TableCell align="right">
                    {/* Carries the service through to BookPage via a query param (not route
                        state) specifically so it survives a login redirect if the visitor
                        isn't logged in yet — see RequireCustomerAuth.tsx. BookPage picks this
                        up on load and pre-selects it, leaving date/slot/confirm untouched. */}
                    <Button
                      component={RouterLink}
                      to={`/book?serviceId=${service.id}`}
                      size="small"
                      variant="outlined"
                      startIcon={<EventAvailableIcon />}
                    >
                      Book
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
