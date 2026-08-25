import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Box from "@mui/material/Box";

const TABS = [
  { to: "/customer/account/profile", label: "Profile" },
  { to: "/customer/account/bookings", label: "My bookings" },
  { to: "/customer/account/security", label: "Security" },
];

// Shared shell for the /customer/account/* pages — same tabbed-shell pattern AdminLayout
// established for /admin/*: one Tabs bar, one <Outlet/>, adding a fourth tab later is "add a
// file + one <Route>", not restructuring this file.
export default function CustomerAccountLayout() {
  const location = useLocation();
  const currentTab = TABS.some((t) => t.to === location.pathname) ? location.pathname : TABS[0].to;

  return (
    <Stack spacing={3}>
      <Typography variant="h4">My account</Typography>

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
