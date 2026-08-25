import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";

// Wrap any staff-facing page's <Route element={...}> with this. If there's no logged-in
// user, redirect to /login instead of rendering the page (and letting its fetch calls fail
// with a raw 401). Passes the page the user was trying to reach via location state, so
// LoginPage can send them back there after a successful login instead of always to "/".
//
// Optional `role` prop adds a second check on top of "is anyone logged in": is THIS role
// allowed here. Reusing the same missing-auth vs wrong-role distinction the backend makes
// (401 vs 403) — a logged-out user gets redirected to log in, but a logged-in STAFF user
// hitting an ADMIN-only page isn't missing anything to fix by logging in again, so this
// shows an inline message instead of bouncing them to a login screen that won't help.
export default function RequireAuth({
  children,
  role,
}: {
  children: ReactNode;
  role?: "ADMIN" | "STAFF";
}) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return (
      <Alert severity="warning">
        <AlertTitle>Access denied</AlertTitle>
        This page requires the {role} role. You're logged in as {user.role}.
      </Alert>
    );
  }

  return <>{children}</>;
}
