import { Link as RouterLink } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import EventNoteIcon from "@mui/icons-material/EventNote";

// Public landing page — the health-check status card that used to live here moved to
// /dashboard (staff/admin only), since "is the API up" and "database connected" are
// operational details, not something a customer booking an appointment needs to see. This
// page's only job now is pointing a customer at the two things they'd actually come here for.
//
// Both buttons below point at customer-auth-gated routes (/book, /customer/bookings)
// rather than assuming the visitor is already logged in — an anonymous click just flows
// through RequireCustomerAuth's existing login-then-redirect-back pattern, the same way it
// already does for /book. This used to point "Find my booking" at /find-booking, back when
// that was a public no-account lookup; it's now a staff-only tool (see FindBookingPage.tsx),
// so a logged-in customer's own "My bookings" page is the equivalent here instead.
export default function HomePage() {
  return (
    <Stack spacing={2} sx={{ maxWidth: 520 }}>
      <Typography variant="h4">Book your appointment</Typography>
      <Typography color="text.secondary">
        Pick a service and an open time slot. You'll need an account — creating one only takes
        a minute, and your email just needs a quick one-time code to verify.
      </Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ pt: 1 }}>
        <Button component={RouterLink} to="/book" variant="contained" size="large" startIcon={<EventAvailableIcon />}>
          Book an appointment
        </Button>
        <Button component={RouterLink} to="/customer/bookings" variant="outlined" size="large" startIcon={<EventNoteIcon />}>
          My bookings
        </Button>
      </Stack>
    </Stack>
  );
}
