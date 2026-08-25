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
import Avatar from "@mui/material/Avatar";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EventNoteIcon from "@mui/icons-material/EventNote";
import PersonIcon from "@mui/icons-material/Person";
import LogoutIcon from "@mui/icons-material/Logout";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ServicesPage from "./pages/ServicesPage";
import BookPage from "./pages/BookPage";
import FindBookingPage from "./pages/FindBookingPage";
import BookingDetailsPage from "./pages/BookingDetailsPage";
import CheckInPage from "./pages/CheckInPage";
import QueuePage from "./pages/QueuePage";
import StaffLoginPage from "./pages/StaffLoginPage";
import CustomerRegisterPage from "./pages/customer/CustomerRegisterPage";
import CustomerVerifyPage from "./pages/customer/CustomerVerifyPage";
import CustomerLoginPage from "./pages/customer/CustomerLoginPage";
import CustomerForgotPasswordPage from "./pages/customer/CustomerForgotPasswordPage";
import CustomerResetPasswordPage from "./pages/customer/CustomerResetPasswordPage";
import CustomerAccountLayout from "./pages/customer/CustomerAccountLayout";
import CustomerProfilePage from "./pages/customer/CustomerProfilePage";
import CustomerBookingsPage from "./pages/customer/CustomerBookingsPage";
import CustomerSecurityPage from "./pages/customer/CustomerSecurityPage";
import RequireCustomerAuth from "./auth/RequireCustomerAuth";
import AdminLayout from "./pages/admin/AdminLayout";
import ResourcesAdminPage from "./pages/admin/ResourcesAdminPage";
import ServicesAdminPage from "./pages/admin/ServicesAdminPage";
import HolidaysAdminPage from "./pages/admin/HolidaysAdminPage";
import HoursAdminPage from "./pages/admin/HoursAdminPage";
import RequireAuth from "./auth/RequireAuth";
import { useAuth } from "./auth/AuthContext";
import { useCustomerAuth } from "./auth/CustomerAuthContext";
import StaffBookingPage from "./pages/StaffBookingPage";

type NavItem = { to: string; label: string; end?: boolean };

// Two separate menus, not one shared list filtered down — a customer should never even see
// Dashboard/Queue/Check-in/Find booking as options (RequireAuth already blocked actually
// reaching them, but offering a link that just bounces you to a staff login screen is a menu
// bug, not a security one). Which list renders is driven by the staff session only (see
// navItems below) — that's the "who's operating this device" question, independent of
// whether a customer also happens to be logged in on the same browser (the customer identity
// slot in the corner stays available either way, see the avatar/drawer sections below).
const STAFF_NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/queue", label: "Queue" },
  { to: "/checkin", label: "Check-in" },
  { to: "/find-booking", label: "Find booking" },
  { to: "/staff/bookings/new", label: "New booking" },
];

const CUSTOMER_NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", end: true },
  { to: "/services", label: "Services" },
  { to: "/book", label: "Book" },
  { to: "/customer/bookings", label: "My bookings" },
  { to: "/customer/account/profile", label: "Profile" },
];

// App is now a layout shell + router, not a page itself. Adding a new screen later means
// adding a <Route> here and a page in src/pages/, not rewriting this file.
export default function App() {
  const { user, logout } = useAuth();
  // Customer session is a fully separate identity from the staff one above — see
  // auth/CustomerAuthContext.tsx. Both can be active on the same device at once (e.g. a
  // front-desk tablet), which is exactly why the AppBar shows two distinct identity slots
  // below instead of one combined "who's logged in" indicator.
  const { customer, logout: customerLogout } = useCustomerAuth();
  const location = useLocation();
  const theme = useTheme();
  // md breakpoint = 900px by default — below that, the inline Toolbar buttons stop fitting
  // and the nav collapses into a Drawer instead. One useMediaQuery call here decides the
  // layout for the whole nav, instead of a dozen per-page media queries elsewhere.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerMenuAnchor, setCustomerMenuAnchor] = useState<null | HTMLElement>(null);

  // Staff nav takes priority whenever a staff session exists — that's the "front desk is
  // running this device" case. Otherwise (no staff logged in, whether or not a customer is)
  // show the customer nav, so an anonymous visitor sees exactly what a logged-in customer
  // sees minus the account-specific links, rather than a third, different menu.
  const navItems: NavItem[] = user
    ? user.role === "ADMIN"
      ? [...STAFF_NAV_ITEMS, { to: "/admin/resources", label: "Admin" }]
      : STAFF_NAV_ITEMS
    : CUSTOMER_NAV_ITEMS;

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
            (customer ? (
              <>
                <IconButton
                  color="inherit"
                  onClick={(e) => setCustomerMenuAnchor(e.currentTarget)}
                  sx={{ ml: 2 }}
                  aria-label="Account menu"
                >
                  <Avatar
                    src={customer.profilePictureUrl || undefined}
                    sx={{ width: 32, height: 32, fontSize: 14 }}
                  >
                    {customer.name.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
                <Menu
                  anchorEl={customerMenuAnchor}
                  open={!!customerMenuAnchor}
                  onClose={() => setCustomerMenuAnchor(null)}
                >
                  <MenuItem
                    component={RouterLink}
                    to="/customer/bookings"
                    onClick={() => setCustomerMenuAnchor(null)}
                  >
                    <ListItemIcon><EventNoteIcon fontSize="small" /></ListItemIcon>
                    My bookings
                  </MenuItem>
                  <MenuItem
                    component={RouterLink}
                    to="/customer/account/profile"
                    onClick={() => setCustomerMenuAnchor(null)}
                  >
                    <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                    Profile
                  </MenuItem>
                  <Divider />
                  <MenuItem
                    onClick={() => {
                      customerLogout();
                      setCustomerMenuAnchor(null);
                    }}
                  >
                    <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                    Log out
                  </MenuItem>
                </Menu>
              </>
            ) : (
              <Button component={RouterLink} to="/customer/login" color="inherit" variant="text" size="small" sx={{ ml: 2 }}>
                Log in / Sign up
              </Button>
            ))}

          {/* Staff identity slot — visually distinct (outlined chip/button vs the customer
              avatar/text-button above) so the two never get mistaken for one login. */}
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
              <Button component={RouterLink} to="/staff/login" color="inherit" variant="outlined" size="small" sx={{ ml: 2 }}>
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
          {customer && (
            <Box sx={{ px: 2, py: 2 }}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Avatar src={customer.profilePictureUrl || undefined} sx={{ width: 36, height: 36 }}>
                  {customer.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {customer.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {customer.email}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                <Button
                  size="small"
                  component={RouterLink}
                  to="/customer/bookings"
                  onClick={() => setDrawerOpen(false)}
                >
                  My bookings
                </Button>
                <Button
                  size="small"
                  component={RouterLink}
                  to="/customer/account/profile"
                  onClick={() => setDrawerOpen(false)}
                >
                  Profile
                </Button>
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => {
                    customerLogout();
                    setDrawerOpen(false);
                  }}
                >
                  Log out
                </Button>
              </Stack>
            </Box>
          )}
          {!customer && (
            <Box sx={{ px: 2, py: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                component={RouterLink}
                to="/customer/login"
                onClick={() => setDrawerOpen(false)}
              >
                Customer log in / Sign up
              </Button>
            </Box>
          )}
          <Divider />
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
                to="/staff/login"
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
          <Route
            path="/book"
            element={
              <RequireCustomerAuth>
                <BookPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/find-booking"
            element={
              <RequireAuth>
                <FindBookingPage />
              </RequireAuth>
            }
          />
          <Route path="/bookings/:bookingRef" element={<BookingDetailsPage />} />
          <Route path="/staff/login" element={<StaffLoginPage />} />
          <Route path="/customer/register" element={<CustomerRegisterPage />} />
          <Route path="/customer/verify" element={<CustomerVerifyPage />} />
          <Route path="/customer/login" element={<CustomerLoginPage />} />
          <Route path="/customer/forgot-password" element={<CustomerForgotPasswordPage />} />
          <Route path="/customer/reset-password" element={<CustomerResetPasswordPage />} />
          <Route
            path="/customer/bookings"
            element={
              <RequireCustomerAuth>
                <CustomerBookingsPage />
              </RequireCustomerAuth>
            }
          />
          <Route
            path="/customer/account"
            element={
              <RequireCustomerAuth>
                <CustomerAccountLayout />
              </RequireCustomerAuth>
            }
          >
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<CustomerProfilePage />} />
            <Route path="security" element={<CustomerSecurityPage />} />
          </Route>
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
            path="/staff/bookings/new"
            element={
              <RequireAuth>
                <StaffBookingPage />
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
