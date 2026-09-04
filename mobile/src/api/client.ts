import { API_BASE_URL } from "./config";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
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
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    // The backend answers errors as { error: "..." }; fall back to the status line when the
    // failure happened before it could (a proxy, or a crash mid-response).
    const message = await response
      .json()
      .then((body: { error?: string }) => body.error)
      .catch(() => undefined);
    throw new ApiError(message ?? `Request failed with status ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}
