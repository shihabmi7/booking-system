import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCustomerAuth } from "./CustomerAuthContext";

// Customer-side equivalent of RequireAuth (staff). Wrap any page that requires a logged-in
// customer — currently BookPage and the /customer/account/* pages. Redirects to
// /customer/login (not /staff/login — the two auth systems never redirect into each other's
// territory) and preserves the page the customer was trying to reach, same "from" location
// state pattern RequireAuth already uses, so CustomerLoginPage can send them back afterward.
export default function RequireCustomerAuth({ children }: { children: ReactNode }) {
  const { customer } = useCustomerAuth();
  const location = useLocation();

  if (!customer) {
    return <Navigate to="/customer/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
