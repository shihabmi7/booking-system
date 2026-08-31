import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerAuthProvider, useCustomerAuth } from "./CustomerAuthContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <CustomerAuthProvider>{children}</CustomerAuthProvider>;
}

const fakeCustomer = { id: "c1", email: "jane@test.local", name: "Jane Doe", phone: null, profilePictureUrl: null };

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("CustomerAuthContext", () => {
  it("uses separate localStorage keys from the staff AuthContext", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "tok", customer: fakeCustomer }) })
    );
    const { result } = renderHook(() => useCustomerAuth(), { wrapper });
    await act(async () => {
      await result.current.login("jane@test.local", "pw");
    });

    expect(localStorage.getItem("bookingSystem.customerToken")).toBe("tok");
    expect(localStorage.getItem("bookingSystem.token")).toBeNull(); // the staff key, untouched
  });

  it("login() failure carries the `unverified` flag through when the server sets it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Please verify your email first", unverified: true }),
      })
    );

    const { result } = renderHook(() => useCustomerAuth(), { wrapper });
    let caught: (Error & { unverified?: boolean }) | undefined;
    await act(async () => {
      try {
        await result.current.login("jane@test.local", "pw");
      } catch (err) {
        caught = err as Error & { unverified?: boolean };
      }
    });

    expect(caught?.message).toBe("Please verify your email first");
    expect(caught?.unverified).toBe(true);
  });

  it("setSession() (used by the OTP-verify auto-login) stores the session directly", () => {
    const { result } = renderHook(() => useCustomerAuth(), { wrapper });
    act(() => result.current.setSession("verify-token", fakeCustomer));

    expect(result.current.token).toBe("verify-token");
    expect(result.current.customer).toEqual(fakeCustomer);
  });

  it("updateCustomer() replaces the stored customer without touching the token", () => {
    const { result } = renderHook(() => useCustomerAuth(), { wrapper });
    act(() => result.current.setSession("tok", fakeCustomer));

    const updated = { ...fakeCustomer, name: "Jane R. Doe" };
    act(() => result.current.updateCustomer(updated));

    expect(result.current.customer?.name).toBe("Jane R. Doe");
    expect(result.current.token).toBe("tok");
    expect(JSON.parse(localStorage.getItem("bookingSystem.customer")!).name).toBe("Jane R. Doe");
  });

  it("logout() clears the customer session", () => {
    const { result } = renderHook(() => useCustomerAuth(), { wrapper });
    act(() => result.current.setSession("tok", fakeCustomer));
    act(() => result.current.logout());

    expect(result.current.customer).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem("bookingSystem.customerToken")).toBeNull();
  });
});
