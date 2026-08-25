import { useCustomerAuth } from "./CustomerAuthContext";

// Customer-side equivalent of useAuthFetch (staff) — same shared "attach token, log out on
// 401" logic, just pointed at the customer session instead. Kept as a separate hook rather
// than parameterizing useAuthFetch, because the two contexts (AuthContext vs
// CustomerAuthContext) are intentionally not unified — see CustomerAuthContext.tsx's header
// comment for why.
export function useCustomerAuthFetch() {
  const { token, logout } = useCustomerAuth();

  return async function customerAuthFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      logout();
      throw new Error("Your session expired. Please log in again.");
    }

    return res;
  };
}
