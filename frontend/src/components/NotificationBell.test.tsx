import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerAuthProvider, useCustomerAuth } from "../auth/CustomerAuthContext";
import NotificationBell from "./NotificationBell";

const fakeCustomer = { id: "c1", email: "jane@test.local", name: "Jane Doe", phone: null, profilePictureUrl: null };

// NotificationBell reads the customer straight from context — logging one in requires a
// component that actually calls setSession(), same as the app's real login flow does, rather
// than pre-seeding localStorage (which would also work, but this exercises the provider's
// live state update path instead of just its mount-time hydration). Runs in an effect, not
// during render — calling a state-setter mid-render here would update CustomerAuthProvider
// (an ancestor) while one of its own descendants is still rendering, which React repeats
// forever since setSession always produces a new object reference.
function LoggedInBell() {
  const { setSession } = useCustomerAuth();
  useEffect(() => {
    setSession("tok", fakeCustomer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <NotificationBell />;
}

function renderBell(loggedIn: boolean) {
  render(
    <MemoryRouter>
      <CustomerAuthProvider>{loggedIn ? <LoggedInBell /> : <NotificationBell />}</CustomerAuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("NotificationBell", () => {
  it("renders nothing when no customer is logged in", () => {
    const { container } = render(
      <MemoryRouter>
        <CustomerAuthProvider>
          <NotificationBell />
        </CustomerAuthProvider>
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the unread count fetched on mount as the badge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ count: 3 }) })
    );

    renderBell(true);

    await waitFor(() => expect(screen.getByText("3")).toBeInTheDocument());
  });

  it("opening the menu loads and displays the notification preview", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("unread-count")) {
          return Promise.resolve({ ok: true, json: async () => ({ count: 1 }) });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: [
              { id: "n1", title: "Booking confirmed", body: "See you soon", readAt: null, createdAt: new Date().toISOString(), booking: null },
            ],
          }),
        });
      })
    );

    renderBell(true);
    await waitFor(() => expect(screen.getByText("1")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByText("Booking confirmed")).toBeInTheDocument();
    expect(screen.getByText("Mark all read")).toBeInTheDocument();
  });

  it("a failed unread-count fetch leaves the badge at zero instead of crashing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    renderBell(true);

    // Nothing to await here except that it didn't throw — the bell icon itself should still
    // be there, just with no visible badge count.
    await waitFor(() => expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument());
    expect(screen.queryByText(/^[1-9]/)).not.toBeInTheDocument();
  });
});
