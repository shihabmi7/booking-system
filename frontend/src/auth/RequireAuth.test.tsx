import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { AuthProvider } from "./AuthContext";
import RequireAuth from "./RequireAuth";

// Seeding localStorage before render (rather than mocking useAuth) exercises the exact same
// "load whatever was saved last session" path AuthContext.test.tsx already verifies in
// isolation — here it's just the input to the thing actually under test, RequireAuth's
// redirect/role logic.
function seedStaffSession(role: "STAFF" | "ADMIN") {
  localStorage.setItem("bookingSystem.token", "tok");
  localStorage.setItem(
    "bookingSystem.user",
    JSON.stringify({ userId: "u1", email: "s@test.local", role, businessId: "b1" })
  );
}

function renderProtected(initialPath: string, requiredRole?: "ADMIN" | "STAFF") {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RequireAuth role={requiredRole}>
                <div>Protected content</div>
              </RequireAuth>
            }
          />
          <Route path="/staff/login" element={<div>Staff login page</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("RequireAuth", () => {
  it("redirects to /staff/login when no one is logged in", () => {
    renderProtected("/dashboard");
    expect(screen.getByText("Staff login page")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders the protected content for any logged-in staff user when no role is required", () => {
    seedStaffSession("STAFF");
    renderProtected("/dashboard");
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("renders the protected content when the user's role matches the required role", () => {
    seedStaffSession("ADMIN");
    renderProtected("/dashboard", "ADMIN");
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("shows an inline access-denied message (not a redirect) for a logged-in user with the wrong role", () => {
    seedStaffSession("STAFF");
    renderProtected("/dashboard", "ADMIN");
    expect(screen.getByText("Access denied")).toBeInTheDocument();
    expect(screen.getByText(/requires the ADMIN role/)).toBeInTheDocument();
    // Not bounced to the login screen — a STAFF user logging in again wouldn't fix anything.
    expect(screen.queryByText("Staff login page")).not.toBeInTheDocument();
  });
});
