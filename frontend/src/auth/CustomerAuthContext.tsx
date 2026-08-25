import { createContext, ReactNode, useContext, useState } from "react";

// Matches the backend's toPublicCustomer() shape (see backend/src/routes/customer.ts) —
// no passwordHash, obviously. Deliberately a totally separate shape from AuthUser (staff) —
// no role, no businessId, an id field named differently in spirit (customerId vs userId on
// the JWT payload) — because these are two different kinds of account, not one "user" with a
// customer/staff flag. See customer-accounts-plan.md's AuthN/AuthZ design section.
export type CustomerUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  profilePictureUrl: string | null;
};

type CustomerAuthContextValue = {
  token: string | null;
  customer: CustomerUser | null;
  // Used by verify-otp (which auto-logs-in on success) and login — both hand back
  // {token, customer} shaped identically, so one setter covers both call sites.
  setSession: (token: string, customer: CustomerUser) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  // Profile PATCH / picture upload return the updated customer — this lets those pages push
  // the new value back into context without a full re-login or a redundant GET /me refetch.
  updateCustomer: (customer: CustomerUser) => void;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

// Separate localStorage keys from the staff AuthContext's — a shared device (e.g. a front-desk
// tablet) can have a staff session AND a customer session open at the same time without either
// clobbering the other.
const TOKEN_KEY = "bookingSystem.customerToken";
const CUSTOMER_KEY = "bookingSystem.customer";

function loadStoredAuth(): { token: string | null; customer: CustomerUser | null } {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawCustomer = localStorage.getItem(CUSTOMER_KEY);
  if (!token || !rawCustomer) return { token: null, customer: null };
  try {
    return { token, customer: JSON.parse(rawCustomer) as CustomerUser };
  } catch {
    return { token: null, customer: null };
  }
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [{ token, customer }, setAuth] = useState(loadStoredAuth);

  function setSession(nextToken: string, nextCustomer: CustomerUser) {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(nextCustomer));
    setAuth({ token: nextToken, customer: nextCustomer });
  }

  async function login(email: string, password: string) {
    const res = await fetch("/api/customer/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      // unverified is a distinct flag the backend sends specifically so this page can offer
      // "resend code" instead of a plain "login failed" — see customer-accounts-plan.md.
      const err = new Error(body.error || `Login failed: ${res.status}`) as Error & { unverified?: boolean };
      if (body.unverified) err.unverified = true;
      throw err;
    }
    setSession(body.token, body.customer);
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
    setAuth({ token: null, customer: null });
  }

  function updateCustomer(nextCustomer: CustomerUser) {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(nextCustomer));
    setAuth((prev) => ({ ...prev, customer: nextCustomer }));
  }

  return (
    <CustomerAuthContext.Provider value={{ token, customer, setSession, login, logout, updateCustomer }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used inside a <CustomerAuthProvider>");
  return ctx;
}
