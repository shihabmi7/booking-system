import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { CustomerAuthProvider } from "./CustomerAuthContext";
import RequireCustomerAuth from "./RequireCustomerAuth";

function seedCustomerSession() {
  localStorage.setItem("bookingSystem.customerToken", "tok");
  localStorage.setItem(
    "bookingSystem.customer",
    JSON.stringify({ id: "c1", email: "jane@test.local", name: "Jane Doe", phone: null, profilePictureUrl: null })
  );
}

function renderProtected(initialPath: string) {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <CustomerAuthProvider>
        <Routes>
          <Route
            path="/book"
            element={
              <RequireCustomerAuth>
                <div>Booking wizard</div>
              </RequireCustomerAuth>
            }
          />
          <Route path="/customer/login" element={<div>Customer login page</div>} />
        </Routes>
      </CustomerAuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("RequireCustomerAuth", () => {
  it("redirects to /customer/login when no customer is logged in", () => {
    renderProtected("/book");
    expect(screen.getByText("Customer login page")).toBeInTheDocument();
  });

  it("renders the protected content when a customer is logged in", () => {
    seedCustomerSession();
    renderProtected("/book");
    expect(screen.getByText("Booking wizard")).toBeInTheDocument();
  });

  it("preserves the query string in the redirect's `from` state, not just the path", () => {
    // ServicesPage's "Book" button sends visitors to /book?serviceId=<id> — losing that query
    // string across the login redirect would silently drop which service they meant to book.
    // Rendering CustomerLoginPage itself is out of scope here; this just confirms the guard
    // computes the right target rather than only the pathname.
    let capturedFrom: string | undefined;
    render(
      <MemoryRouter initialEntries={["/book?serviceId=abc123"]}>
        <CustomerAuthProvider>
          <Routes>
            <Route
              path="/book"
              element={
                <RequireCustomerAuth>
                  <div>Booking wizard</div>
                </RequireCustomerAuth>
              }
            />
            <Route
              path="/customer/login"
              element={<CaptureLocationState onCapture={(state) => (capturedFrom = state?.from)} />}
            />
          </Routes>
        </CustomerAuthProvider>
      </MemoryRouter>
    );
    expect(capturedFrom).toBe("/book?serviceId=abc123");
  });
});

// Tiny test-only helper to read the Navigate's `state` prop, since RTL has no built-in way
// to inspect router state — renders nothing itself, just reports what it received.
function CaptureLocationState({ onCapture }: { onCapture: (state?: { from?: string }) => void }) {
  const location = useLocation();
  onCapture(location.state);
  return <div>Customer login page</div>;
}
