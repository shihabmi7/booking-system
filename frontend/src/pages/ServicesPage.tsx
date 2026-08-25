import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
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
import EventAvailableIcon from "@mui/icons-material/EventAvailable";

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
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/services")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        return res.json();
      })
      .then(setServices)
      .catch((err) => setError(err.message));
  }, []);

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
