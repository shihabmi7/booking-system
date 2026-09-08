import { useCustomerAuth } from "./CustomerAuthContext";
import { ApiError, apiFetch } from "@/api/client";

export class SessionExpiredError extends Error {}

/**
 * Mobile equivalent of the web app's useCustomerAuthFetch (frontend/src/auth/
 * useCustomerAuthFetch.ts) — attach the stored token, and treat a 401 as "log this customer
 * out," since a valid session should never get one from an endpoint that requires customer
 * auth. Built on apiFetch rather than raw fetch so JSON parsing/error-body handling stays in
 * one place; the only thing added here is the Authorization header and the 401 side effect.
 */
export function useAuthedFetch() {
  const { token, logout } = useCustomerAuth();

  return async function authedFetch<T>(path: string, init?: RequestInit): Promise<T> {
    try {
      return await apiFetch<T>(path, {
        ...init,
        headers: { ...init?.headers, Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await logout();
        throw new SessionExpiredError();
      }
      throw err;
    }
  };
}
