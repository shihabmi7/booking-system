import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";

const TABS = [
  { to: "/admin/resources", label: "Resources" },
  { to: "/admin/services", label: "Services" },
  { to: "/admin/holidays", label: "Holidays" },
  { to: "/admin/hours", label: "Hours" },
  { to: "/admin/notifications", label: "Notifications" },
];

// Shared shell for the /admin/* pages — an MUI Tabs bar (Resources / Services / Holidays /
// Hours) plus an <Outlet/> for whichever admin page is active. Mirrors why App.tsx itself is
// a layout shell around <Routes> instead of one big component: adding a fifth admin page
// later is "add a file + one <Route>", not restructuring this one.
export default function AdminLayout() {
  const location = useLocation();
  // Tabs' `value` needs to match one of its Tab `value`s exactly, and MUI warns (or renders
  // nothing selected) otherwise — falling back to the first tab's path keeps the bar visually
  // consistent while a nested route render is in flight during a URL change.
  const currentTab = TABS.some((t) => t.to === location.pathname) ? location.pathname : TABS[0].to;

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Admin settings</Typography>

      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs value={currentTab} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          {TABS.map((tab) => (
            <Tab key={tab.to} label={tab.label} value={tab.to} component={RouterLink} to={tab.to} />
          ))}
        </Tabs>
      </Box>

      <Outlet />
    </Stack>
  );
}
