import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // The backend sometimes sends extra fields alongside `error` (e.g. `unverified` on customer
    // login) that change which follow-up action a screen offers, not just what it displays —
    // carrying the raw body lets a call site read those without a second, message-string-based
    // parse of an error that's meant to be prose, not a stable identifier.
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * The one place a URL gets built and a response gets unwrapped.
 *
 * Errors are thrown rather than returned as a result object here — the opposite of the backend's
 * service convention — because the consumer on this side is React, and every screen's rendering
 * of a failure is the same three states (loading / error / data). Throwing is what data-fetching
 * hooks expect, so a Result type would just be unwrapped back into a throw at every call site.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // A FormData body (the profile picture upload) must NOT get an explicit Content-Type — fetch
  // sets multipart/form-data with the correct boundary itself, and overriding it here breaks
  // the upload silently (the request looks fine, the backend's multer just can't parse it).
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body && !isFormData ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    // The backend answers errors as { error: "..." }; fall back to the status line when the
    // failure happened before it could (a proxy, or a crash mid-response).
    const body = await response
      .json()
      .catch(() => undefined) as { error?: string } | undefined;
    throw new ApiError(body?.error ?? `Request failed with status ${response.status}`, response.status, body);
  }

  return (await response.json()) as T;
}
