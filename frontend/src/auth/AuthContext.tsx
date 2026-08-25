import { createContext, ReactNode, useContext, useState } from "react";

// Matches the backend's AuthTokenPayload (see backend/src/services/auth.ts) minus the JWT's
// own exp/iat fields — this is what we actually care about on the frontend.
export type AuthUser = {
  userId: string;
  email: string;
  role: "STAFF" | "ADMIN";
  businessId: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "bookingSystem.token";
const USER_KEY = "bookingSystem.user";

// Loads whatever was saved last session, so a page refresh doesn't log the user out.
// This is exactly the JWT-in-localStorage tradeoff discussed in the interview-prep notes:
// simple to wire up, but means the token is readable by any script on the page (XSS risk),
// unlike an httpOnly cookie which the server would have to set instead.
function loadStoredAuth(): { token: string | null; user: AuthUser | null } {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return { token: null, user: null };
  try {
    return { token, user: JSON.parse(rawUser) as AuthUser };
  } catch {
    // Corrupted localStorage value — treat as logged out rather than crashing the app.
    return { token: null, user: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [{ token, user }, setAuth] = useState(loadStoredAuth);

  async function login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || `Login failed: ${res.status}`);
    }

    const nextUser: AuthUser = body.user;
    localStorage.setItem(TOKEN_KEY, body.token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setAuth({ token: body.token, user: nextUser });
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuth({ token: null, user: null });
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>{children}</AuthContext.Provider>
  );
}

// Small hook so pages can just call useAuth() instead of importing useContext + AuthContext
// everywhere. Throws if used outside the provider — a cheap way to catch a missing
// <AuthProvider> wrapper at dev time instead of silently getting `null` and crashing later.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an <AuthProvider>");
  return ctx;
}
