import { useAuth } from "./AuthContext";

// Wraps fetch() so every staff-facing call automatically sends the current token and reacts
// to an expired/invalid one the same way, instead of each page repeating that logic (this was
// flagged as a "next improvement" in interview-prep-frontend.md while there were only two
// staff pages — now that a third and fourth are being added for the admin section, the
// duplication would actually become a problem, so it's worth doing now).
export function useAuthFetch() {
  const { token, logout } = useAuth();

  return async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(input, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });

    // A 401 here means the token expired or was invalidated server-side — log out and let
    // the caller's error handling show a "session expired" message instead of a raw failure.
    if (res.status === 401) {
      logout();
      throw new Error("Your session expired. Please log in again.");
    }

    return res;
  };
}
