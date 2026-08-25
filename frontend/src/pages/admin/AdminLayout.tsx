import { NavLink, Outlet } from "react-router-dom";

// Shared shell for the /admin/* pages — a small sub-nav (Resources / Services / Holidays /
// Hours) plus an <Outlet/> for whichever admin page is active. Mirrors why App.tsx itself is
// a layout shell around <Routes> instead of one big component: adding a fifth admin page
// later is "add a file + one <Route>", not restructuring this one.
export default function AdminLayout() {
  const tabStyle = ({ isActive }: { isActive: boolean }) => ({
    marginRight: "1rem",
    fontWeight: isActive ? ("bold" as const) : ("normal" as const),
  });

  return (
    <div>
      <h1>Admin settings</h1>
      <nav style={{ marginBottom: "1.5rem" }}>
        <NavLink to="/admin/resources" style={tabStyle}>
          Resources
        </NavLink>
        <NavLink to="/admin/services" style={tabStyle}>
          Services
        </NavLink>
        <NavLink to="/admin/holidays" style={tabStyle}>
          Holidays
        </NavLink>
        <NavLink to="/admin/hours" style={tabStyle}>
          Hours
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
