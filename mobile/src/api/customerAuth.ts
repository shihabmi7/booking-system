import { ApiError, apiFetch } from "./client";

// Mirrors the backend's toPublicCustomer() shape (backend/src/routes/customer.ts) and the web
// app's CustomerUser (frontend/src/auth/CustomerAuthContext.tsx) — no passwordHash, obviously.
export type CustomerUser = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  profilePictureUrl: string | null;
};

export type AuthSession = { token: string; customer: CustomerUser };

export function register(input: { name: string; email: string; phone?: string; password: string }) {
  return apiFetch<{ email: string; message: string }>("/api/customer/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function verifyOtp(input: { email: string; code: string }) {
  return apiFetch<AuthSession>("/api/customer/verify-otp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function resendOtp(input: { email: string }) {
  return apiFetch<{ message: string }>("/api/customer/resend-otp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// unverified is a distinct flag the backend sends specifically so the login screen can offer
// "verify now" instead of a plain "login failed" — see backend/src/routes/customer.ts.
export class UnverifiedLoginError extends Error {
  readonly unverified = true;
}

export async function login(input: { email: string; password: string }): Promise<AuthSession> {
  try {
    return await apiFetch<AuthSession>("/api/customer/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  } catch (err) {
    const unverified = err instanceof ApiError && (err.body as { unverified?: boolean } | undefined)?.unverified;
    if (unverified) throw new UnverifiedLoginError(err.message);
    throw err;
  }
}

export function forgotPassword(input: { email: string }) {
  return apiFetch<{ message: string }>("/api/customer/forgot-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function resetPassword(input: { email: string; code: string; newPassword: string }) {
  return apiFetch<{ message: string }>("/api/customer/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
