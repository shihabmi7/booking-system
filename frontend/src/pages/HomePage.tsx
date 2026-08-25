import { Link as RouterLink } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import SearchIcon from "@mui/icons-material/Search";

// Public landing page — the health-check status card that used to live here moved to
// /dashboard (staff/admin only), since "is the API up" and "database connected" are
// operational details, not something a customer booking an appointment needs to see. This
// page's only job now is pointing a customer at the two things they'd actually come here for.
export default function HomePage() {
  return (
    <Stack spacing={2} sx={{ maxWidth: 520 }}>
      <Typography variant="h4">Book your appointment</Typography>
      <Typography color="text.secondary">
        Pick a service and an open time slot — no account needed. Already booked? Look up your
        appointment with your booking reference.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
        <Button component={RouterLink} to="/book" variant="contained" size="large" startIcon={<EventAvailableIcon />}>
          Book an appointment
        </Button>
        <Button component={RouterLink} to="/find-booking" variant="outlined" size="large" startIcon={<SearchIcon />}>
          Find my booking
        </Button>
      </Stack>
    </Stack>
  );
}
