import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Wrap any staff-facing page's <Route element={...}> with this. If there's no logged-in
// user, redirect to /login instead of rendering the page (and letting its fetch calls fail
// with a raw 401). Passes the page the user was trying to reach via location state, so
// LoginPage can send them back there after a successful login instead of always to "/".
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
