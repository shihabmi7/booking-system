import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";

import { login as loginRequest } from "@/api/customerAuth";
import { CustomerAuthProvider, useCustomerAuth } from "@/auth/CustomerAuthContext";

jest.mock("@/api/customerAuth", () => ({
  ...jest.requireActual("@/api/customerAuth"),
  login: jest.fn(),
}));
const mockLogin = jest.mocked(loginRequest);

const customer = { id: "1", email: "ada@example.com", name: "Ada", phone: null, profilePictureUrl: null };

// `renderHook` returns a Promise as of @testing-library/react-native v14 (its render() moved
// async to match React 19's own act() requirements) — every call here is awaited for that reason,
// not out of caution. Calls that trigger a state update (login/logout/updateCustomer) are wrapped
// in `act` so React commits and warns about the update in the same tick a real event would.
describe("CustomerAuthContext", () => {
  beforeEach(async () => {
    mockLogin.mockReset();
    await AsyncStorage.clear();
    (SecureStore as unknown as { __clear: () => void }).__clear();
  });

  it("settles to signedOut when nothing was previously stored", async () => {
    const { result } = await renderHook(() => useCustomerAuth(), { wrapper: CustomerAuthProvider });

    await waitFor(() => expect(result.current.status).toBe("signedOut"));
    expect(result.current.token).toBeNull();
    expect(result.current.customer).toBeNull();
  });

  // The core Phase 2 guarantee: a session survives what amounts to an app restart, restored from
  // the same SecureStore/AsyncStorage keys a real cold start would read from.
  it("restores a previously saved session on mount", async () => {
    await SecureStore.setItemAsync("bookingSystem.customerToken", "stored-token");
    await AsyncStorage.setItem("bookingSystem.customer", JSON.stringify(customer));

    const { result } = await renderHook(() => useCustomerAuth(), { wrapper: CustomerAuthProvider });

    await waitFor(() => expect(result.current.status).toBe("signedIn"));
    expect(result.current.token).toBe("stored-token");
    expect(result.current.customer).toEqual(customer);
  });

  it("login() persists the session to SecureStore and AsyncStorage", async () => {
    mockLogin.mockResolvedValue({ token: "new-token", customer });
    const { result } = await renderHook(() => useCustomerAuth(), { wrapper: CustomerAuthProvider });
    await waitFor(() => expect(result.current.status).toBe("signedOut"));

    await act(() => result.current.login("ada@example.com", "password1"));

    expect(result.current.status).toBe("signedIn");
    expect(result.current.token).toBe("new-token");
    expect(await SecureStore.getItemAsync("bookingSystem.customerToken")).toBe("new-token");
    expect(await AsyncStorage.getItem("bookingSystem.customer")).toBe(JSON.stringify(customer));
  });

  it("logout() clears both the state and the persisted storage", async () => {
    mockLogin.mockResolvedValue({ token: "new-token", customer });
    const { result } = await renderHook(() => useCustomerAuth(), { wrapper: CustomerAuthProvider });
    await waitFor(() => expect(result.current.status).toBe("signedOut"));
    await act(() => result.current.login("ada@example.com", "password1"));

    await act(() => result.current.logout());

    expect(result.current.status).toBe("signedOut");
    expect(result.current.customer).toBeNull();
    expect(await SecureStore.getItemAsync("bookingSystem.customerToken")).toBeNull();
    expect(await AsyncStorage.getItem("bookingSystem.customer")).toBeNull();
  });

  it("updateCustomer() replaces the profile without touching the token", async () => {
    mockLogin.mockResolvedValue({ token: "new-token", customer });
    const { result } = await renderHook(() => useCustomerAuth(), { wrapper: CustomerAuthProvider });
    await waitFor(() => expect(result.current.status).toBe("signedOut"));
    await act(() => result.current.login("ada@example.com", "password1"));

    const updated = { ...customer, name: "Ada Lovelace" };
    await act(() => result.current.updateCustomer(updated));

    expect(result.current.customer).toEqual(updated);
    expect(result.current.token).toBe("new-token");
    expect(await AsyncStorage.getItem("bookingSystem.customer")).toBe(JSON.stringify(updated));
  });
});
