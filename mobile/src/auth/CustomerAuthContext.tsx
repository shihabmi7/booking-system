import { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { login as loginRequest, type CustomerUser } from "@/api/customerAuth";
import { clearSession, loadStoredSession, saveCustomer, saveSession } from "./customerSession";

export type { CustomerUser };

type AuthState = {
  status: "loading" | "signedIn" | "signedOut";
  token: string | null;
  customer: CustomerUser | null;
};

type CustomerAuthContextValue = AuthState & {
  // Used by verify-otp (which auto-logs-in on success) and login — both hand back
  // {token, customer} shaped identically, so one setter covers both call sites.
  setSession: (token: string, customer: CustomerUser) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Profile PATCH / picture upload (Phase 5) return the updated customer — this lets those
  // screens push the new value back into context without a full re-login or refetch.
  updateCustomer: (customer: CustomerUser) => Promise<void>;
};

const CustomerAuthContext = createContext<CustomerAuthContextValue | null>(null);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", token: null, customer: null });

  // Restoring from SecureStore/AsyncStorage is inherently async (unlike web's synchronous
  // localStorage read), which is why "loading" is a distinct third status here rather than just
  // starting from signedOut — the root layout holds the splash screen on it to avoid a flash of
  // the login screen for a customer who is actually still signed in.
  useEffect(() => {
    void loadStoredSession().then(({ token, customer }) => {
      setState(token && customer ? { status: "signedIn", token, customer } : { status: "signedOut", token: null, customer: null });
    });
  }, []);

  async function setSession(token: string, customer: CustomerUser) {
    await saveSession(token, customer);
    setState({ status: "signedIn", token, customer });
  }

  async function login(email: string, password: string) {
    const session = await loginRequest({ email, password });
    await setSession(session.token, session.customer);
  }

  async function logout() {
    await clearSession();
    setState({ status: "signedOut", token: null, customer: null });
  }

  async function updateCustomer(customer: CustomerUser) {
    await saveCustomer(customer);
    setState((prev) => ({ ...prev, customer }));
  }

  return (
    <CustomerAuthContext.Provider value={{ ...state, setSession, login, logout, updateCustomer }}>
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth(): CustomerAuthContextValue {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used inside a <CustomerAuthProvider>");
  return ctx;
}
