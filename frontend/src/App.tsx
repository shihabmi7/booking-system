import { NavLink, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ServicesPage from "./pages/ServicesPage";
import BookPage from "./pages/BookPage";
import FindBookingPage from "./pages/FindBookingPage";
import BookingDetailsPage from "./pages/BookingDetailsPage";
import CheckInPage from "./pages/CheckInPage";
import QueuePage from "./pages/QueuePage";
import LoginPage from "./pages/LoginPage";
import RequireAuth from "./auth/RequireAuth";
import { useAuth } from "./auth/AuthContext";

// App is now a layout shell + router, not a page itself. Adding a new screen later means
// adding a <Route> here and a page in src/pages/, not rewriting this file.
export default function App() {
  const { user, logout } = useAuth();

  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    marginRight: "1rem",
    fontWeight: isActive ? ("bold" as const) : ("normal" as const),
  });

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800 }}>
      <nav style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center" }}>
        <NavLink to="/" style={linkStyle} end>
          Home
        </NavLink>
        <NavLink to="/services" style={linkStyle}>
          Services
        </NavLink>
        <NavLink to="/book" style={linkStyle}>
          Book
        </NavLink>
        <NavLink to="/find-booking" style={linkStyle}>
          Find Booking
        </NavLink>
        {/* Check-in and Queue are staff-only (see RequireAuth below on the matching routes),
            but the links stay visible either way — clicking them while logged out just
            redirects to /login instead of hiding the fact that these pages exist. */}
        <NavLink to="/checkin" style={linkStyle}>
          Check-in
        </NavLink>
        <NavLink to="/queue" style={linkStyle}>
          Queue
        </NavLink>

        <span style={{ marginLeft: "auto", fontSize: "0.9rem" }}>
          {user ? (
            <>
              {user.email} ({user.role}){" "}
              <button type="button" onClick={logout} style={{ marginLeft: "0.5rem" }}>
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login" style={linkStyle}>
              Staff Login
            </NavLink>
          )}
        </span>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
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
      </Routes>
    </main>
  );
}
