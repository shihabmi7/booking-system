import { NavLink, Route, Routes } from "react-router-dom";
import HomePage from "./pages/HomePage";
import ServicesPage from "./pages/ServicesPage";
import BookPage from "./pages/BookPage";
import FindBookingPage from "./pages/FindBookingPage";
import BookingDetailsPage from "./pages/BookingDetailsPage";
import CheckInPage from "./pages/CheckInPage";
import QueuePage from "./pages/QueuePage";

// App is now a layout shell + router, not a page itself. Adding a new screen later means
// adding a <Route> here and a page in src/pages/, not rewriting this file.
export default function App() {
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    marginRight: "1rem",
    fontWeight: isActive ? ("bold" as const) : ("normal" as const),
  });

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", maxWidth: 800 }}>
      <nav style={{ marginBottom: "1.5rem" }}>
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
        <NavLink to="/checkin" style={linkStyle}>
          Check-in
        </NavLink>
        <NavLink to="/queue" style={linkStyle}>
          Queue
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/book" element={<BookPage />} />
        <Route path="/find-booking" element={<FindBookingPage />} />
        <Route path="/bookings/:bookingRef" element={<BookingDetailsPage />} />
        <Route path="/checkin" element={<CheckInPage />} />
        <Route path="/queue" element={<QueuePage />} />
      </Routes>
    </main>
  );
}
