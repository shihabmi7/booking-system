import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import { CustomerAuthProvider, useCustomerAuth } from "@/auth/CustomerAuthContext";
import { SessionExpiredError, useAuthedFetch } from "@/auth/useAuthedFetch";
import { API_BASE_URL } from "@/api/config";

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

// Renders both hooks under one CustomerAuthProvider so useAuthedFetch's `logout` call is the
// SAME context instance a screen would see — a hook-per-render-call test would prove the fetch
// wrapper's logic but not that a 401 actually reaches the shared session.
function setup() {
  return renderHook(
    () => {
      const auth = useCustomerAuth();
      const authedFetch = useAuthedFetch();
      return { auth, authedFetch };
    },
    { wrapper: CustomerAuthProvider },
  );
}

describe("useAuthedFetch", () => {
  beforeEach(async () => {
    mockFetch.mockReset();
    await AsyncStorage.clear();
    (SecureStore as unknown as { __clear: () => void }).__clear();
  });

  it("attaches the stored token as a Bearer header", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.auth.status).toBe("signedOut"));
    await act(async () => {
      await result.current.auth.setSession("tok-123", {
        id: "1",
        email: "a@b.com",
        name: "Ada",
        phone: null,
        profilePictureUrl: null,
      });
    });
    mockFetch.mockResolvedValue(jsonResponse({ ok: true }));

    await result.current.authedFetch("/api/customer/bookings");

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/customer/bookings`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok-123" }) }),
    );
  });

  // The one behavior this wrapper adds beyond apiFetch: a 401 from an endpoint that requires
  // customer auth means the session itself is no longer valid (expired, revoked) — never a
  // retryable error — so it logs the customer out rather than surfacing a generic failure.
  it("logs out and raises SessionExpiredError on a 401", async () => {
    const { result } = await setup();
    await waitFor(() => expect(result.current.auth.status).toBe("signedOut"));
    await act(async () => {
      await result.current.auth.setSession("tok-123", {
        id: "1",
        email: "a@b.com",
        name: "Ada",
        phone: null,
        profilePictureUrl: null,
      });
    });
    mockFetch.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, false, 401));

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.authedFetch("/api/customer/bookings");
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(SessionExpiredError);
    expect(result.current.auth.status).toBe("signedOut");
    expect(result.current.auth.token).toBeNull();
  });
});
