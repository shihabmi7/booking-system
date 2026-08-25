import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useCustomerAuth } from "./CustomerAuthContext";

// Customer-side equivalent of RequireAuth (staff). Wrap any page that requires a logged-in
// customer — currently BookPage, ServicesPage, /customer/bookings, and the
// /customer/account/* pages. Redirects to /customer/login (not /staff/login — the two auth
// systems never redirect into each other's territory) and preserves the page the customer was
// trying to reach, same "from" location state pattern RequireAuth already uses, so
// CustomerLoginPage can send them back afterward.
//
// Includes location.search, not just pathname — e.g. ServicesPage's "Book" button sends an
// anonymous visitor to /book?serviceId=<id>; without the query string surviving this redirect,
// they'd land back on a plain /book after logging in with no service pre-selected, silently
// losing the one thing the click was supposed to carry through.
export default function RequireCustomerAuth({ children }: { children: ReactNode }) {
  const { customer } = useCustomerAuth();
  const location = useLocation();

  if (!customer) {
    return (
      <Navigate
        to="/customer/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}
