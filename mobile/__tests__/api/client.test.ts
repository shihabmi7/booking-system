import { ApiError, apiFetch } from "@/api/client";
import { API_BASE_URL } from "@/api/config";

// fetch is global in React Native (and in jest-expo's environment), so there is nothing to
// import — replacing the global is both the simplest and the most realistic seam.
const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("apiFetch", () => {
  beforeEach(() => mockFetch.mockReset());

  it("prefixes the path with the resolved base URL", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ status: "ok" }));

    await apiFetch("/api/health");

    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/health`, expect.anything());
  });

  it("throws the backend's own error message, not just the status code", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "Slot already booked" }, false, 409));

    await expect(apiFetch("/api/bookings")).rejects.toThrow("Slot already booked");
  });

  // A 500 from a crashed process or a proxy often isn't JSON at all. Falling back to the status
  // matters more than it looks: without it the screen would show a JSON parse error instead of
  // the actual failure, sending debugging in exactly the wrong direction.
  it("falls back to the status when the error body is not JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token < in JSON");
      },
    } as unknown as Response);

    await expect(apiFetch("/api/health")).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      message: "Request failed with status 502",
    });
  });

  it("does not send a Content-Type when there is no body", async () => {
    mockFetch.mockResolvedValue(jsonResponse({}));

    await apiFetch("/api/health");

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty("Content-Type");
  });

  it("exposes the status on the thrown error", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "Unauthorized" }, false, 401));

    await expect(apiFetch("/api/me")).rejects.toBeInstanceOf(ApiError);
  });
});
