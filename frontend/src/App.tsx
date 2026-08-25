import { useState } from "react";
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ServicesPage from "./pages/ServicesPage";
import BookPage from "./pages/BookPage";
import FindBookingPage from "./pages/FindBookingPage";
import BookingDetailsPage from "./pages/BookingDetailsPage";
import CheckInPage from "./pages/CheckInPage";
import QueuePage from "./pages/QueuePage";
import LoginPage from "./pages/LoginPage";
import AdminLayout from "./pages/admin/AdminLayout";
import ResourcesAdminPage from "./pages/admin/ResourcesAdminPage";
import ServicesAdminPage from "./pages/admin/ServicesAdminPage";
import HolidaysAdminPage from "./pages/admin/HolidaysAdminPage";
import HoursAdminPage from "./pages/admin/HoursAdminPage";
import RequireAuth from "./auth/RequireAuth";
import { useAuth } from "./auth/AuthContext";

type NavItem = { to: string; label: string; end?: boolean };

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/services", label: "Services" },
  { to: "/book", label: "Book" },
  { to: "/find-booking", label: "Find booking" },
  { to: "/checkin", label: "Check-in" },
  { to: "/queue", label: "Queue" },
];

// App is now a layout shell + router, not a page itself. Adding a new screen later means
// adding a <Route> here and a page in src/pages/, not rewriting this file.
export default function App() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const theme = useTheme();
  // md breakpoint = 900px by default — below that, the inline Toolbar buttons stop fitting
  // and the nav collapses into a Drawer instead. One useMediaQuery call here decides the
  // layout for the whole nav, instead of a dozen per-page media queries elsewhere.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems: NavItem[] =
    user?.role === "ADMIN" ? [...NAV_ITEMS, { to: "/admin/resources", label: "Admin" }] : NAV_ITEMS;

  function isActive(item: NavItem) {
    return item.end ? location.pathname === item.to : location.pathname.startsWith(item.to);
  }

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppBar position="sticky" color="primary">
        <Toolbar sx={{ gap: 1 }}>
          <CalendarMonthIcon sx={{ mr: 1 }} />
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ color: "inherit", textDecoration: "none", fontWeight: 600, flexGrow: 1 }}
          >
            Booking System
          </Typography>

          {!isMobile &&
            navItems.map((item) => (
              <Button
                key={item.to}
                component={RouterLink}
                to={item.to}
                sx={{
                  color: "inherit",
                  fontWeight: isActive(item) ? 700 : 400,
                  borderBottom: isActive(item) ? "2px solid currentColor" : "2px solid transparent",
                  borderRadius: 0,
                }}
              >
                {item.label}
              </Button>
            ))}

          {!isMobile &&
            (user ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 2 }}>
                <Chip
                  label={`${user.email} · ${user.role}`}
                  size="small"
                  sx={{ bgcolor: "rgba(255,255,255,0.16)", color: "inherit" }}
                />
                <Button color="inherit" variant="outlined" size="small" onClick={logout}>
                  Log out
                </Button>
              </Stack>
            ) : (
              <Button component={RouterLink} to="/login" color="inherit" variant="outlined" size="small" sx={{ ml: 2 }}>
                Staff login
              </Button>
            ))}

          {isMobile && (
            <IconButton color="inherit" edge="end" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 260 }} role="presentation">
          {user && (
            <Box sx={{ px: 2, py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Signed in as
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {user.email}
              </Typography>
              <Chip label={user.role} size="small" color="primary" sx={{ mt: 0.5 }} />
            </Box>
          )}
          <Divider />
          <List>
            {navItems.map((item) => (
              <ListItemButton
                key={item.to}
                component={RouterLink}
                to={item.to}
                selected={isActive(item)}
                onClick={() => setDrawerOpen(false)}
              >
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
          <Divider />
          <Box sx={{ p: 2 }}>
            {user ? (
              <Button fullWidth variant="outlined" onClick={() => { logout(); setDrawerOpen(false); }}>
                Log out
              </Button>
            ) : (
              <Button
                fullWidth
                variant="contained"
                component={RouterLink}
                to="/login"
                onClick={() => setDrawerOpen(false)}
              >
                Staff login
              </Button>
            )}
          </Box>
        </Box>
      </Drawer>

      <Container maxWidth="lg" sx={{ flexGrow: 1, py: { xs: 3, md: 4 } }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <DashboardPage />
              </RequireAuth>
            }
          />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/book" element={<BookPage />} />
          <Route path="/find-booking" element={<FindBookingPage />} />
          <Route path="/bookings/:bookingRef" element={<BookingDetailsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/checkin"
            element={
              <RequireAuth>
                <CheckInPage />
              </RequireAuth>
            }
          />
          <Route
            path="/queue"
            element={
              <RequireAuth>
                <QueuePage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth role="ADMIN">
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Navigate to="resources" replace />} />
            <Route path="resources" element={<ResourcesAdminPage />} />
            <Route path="services" element={<ServicesAdminPage />} />
            <Route path="holidays" element={<HolidaysAdminPage />} />
            <Route path="hours" element={<HoursAdminPage />} />
          </Route>
        </Routes>
      </Container>
    </Box>
  );
}
