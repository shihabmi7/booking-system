import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("AuthContext", () => {
  it("starts logged out when localStorage is empty", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("login() stores the token/user and updates context state on success", async () => {
    const fakeUser = { userId: "u1", email: "staff@test.local", role: "STAFF" as const, businessId: "b1" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: "fake-jwt", user: fakeUser }),
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.login("staff@test.local", "password123");
    });

    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.token).toBe("fake-jwt");
    expect(localStorage.getItem("bookingSystem.token")).toBe("fake-jwt");
    expect(JSON.parse(localStorage.getItem("bookingSystem.user")!)).toEqual(fakeUser);
  });

  it("login() throws the server's error message and doesn't touch storage on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Invalid email or password" }),
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(
      act(async () => {
        await result.current.login("staff@test.local", "wrong");
      })
    ).rejects.toThrow("Invalid email or password");

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("bookingSystem.token")).toBeNull();
  });

  it("loads whatever was already in localStorage on mount, so a refresh doesn't log the user out", () => {
    const storedUser = { userId: "u1", email: "staff@test.local", role: "ADMIN" as const, businessId: "b1" };
    localStorage.setItem("bookingSystem.token", "existing-token");
    localStorage.setItem("bookingSystem.user", JSON.stringify(storedUser));

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.token).toBe("existing-token");
    expect(result.current.user).toEqual(storedUser);
  });

  it("treats corrupted localStorage as logged-out instead of crashing", () => {
    localStorage.setItem("bookingSystem.token", "some-token");
    localStorage.setItem("bookingSystem.user", "{not valid json");

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("logout() clears both context state and localStorage", async () => {
    localStorage.setItem("bookingSystem.token", "existing-token");
    localStorage.setItem(
      "bookingSystem.user",
      JSON.stringify({ userId: "u1", email: "s@test.local", role: "STAFF", businessId: "b1" })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.logout());

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(localStorage.getItem("bookingSystem.token")).toBeNull();
    expect(localStorage.getItem("bookingSystem.user")).toBeNull();
  });

  it("useAuth() throws when used outside an AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/must be used inside an <AuthProvider>/);
  });
});
