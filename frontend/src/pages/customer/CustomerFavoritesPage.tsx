import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useCustomerAuthFetch } from "../../auth/useCustomerAuthFetch";
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
import Link from "@mui/material/Link";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";

// Shape returned by GET /api/favorites — the favorited Service plus when it was favorited,
// see routes/favorites.ts.
type FavoriteService = {
  id: string;
  name: string;
  durationMins: number;
  price: string;
  favoritedAt: string;
  resource: { name: string; business: { name: string } };
};

// /customer/favorites — quick re-booking shortcuts for services a customer has starred on
// ServicesPage. Same row shape as ServicesPage's table (this is deliberately the "just my
// favorites" filtered view of that same list, not a different presentation of the data).
export default function CustomerFavoritesPage() {
  const customerAuthFetch = useCustomerAuthFetch();
  const [favorites, setFavorites] = useState<FavoriteService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  function load() {
    customerAuthFetch("/api/favorites")
      .then((res) => res.json())
      .then(setFavorites)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load favorites"));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  async function handleRemove(serviceId: string) {
    setRemovingId(serviceId);
    try {
      await customerAuthFetch(`/api/favorites/${serviceId}`, { method: "DELETE" });
      setFavorites((prev) => prev?.filter((f) => f.id !== serviceId) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove favorite");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Favorites</Typography>

      {error && <Alert severity="error">{error}</Alert>}

      {!error && !favorites && <Skeleton variant="rounded" height={180} />}

      {favorites && favorites.length === 0 && (
        <Alert severity="info">
          No favorites yet. Star a service on the{" "}
          <Link component={RouterLink} to="/services">
            Services
          </Link>{" "}
          page to add a quick rebooking shortcut here.
        </Alert>
      )}

      {favorites && favorites.length > 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Service</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Business</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {favorites.map((f) => (
                <TableRow key={f.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{f.name}</TableCell>
                  <TableCell>
                    <Chip size="small" label={`${f.durationMins} min`} />
                  </TableCell>
                  <TableCell>${f.price}</TableCell>
                  <TableCell>{f.resource.name}</TableCell>
                  <TableCell>{f.resource.business.name}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        component={RouterLink}
                        to={`/book?serviceId=${f.id}`}
                        size="small"
                        variant="outlined"
                        startIcon={<EventAvailableIcon />}
                      >
                        Book
                      </Button>
                      <Button size="small" color="error" disabled={removingId === f.id} onClick={() => handleRemove(f.id)}>
                        Remove
                      </Button>
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
