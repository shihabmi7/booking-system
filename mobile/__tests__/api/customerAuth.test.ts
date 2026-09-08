import {
  forgotPassword,
  login,
  register,
  resendOtp,
  resetPassword,
  UnverifiedLoginError,
  verifyOtp,
} from "@/api/customerAuth";
import { API_BASE_URL } from "@/api/config";

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("customer auth API client", () => {
  beforeEach(() => mockFetch.mockReset());

  it("posts registration fields to /api/customer/register", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ email: "a@b.com", message: "Check your email" }));

    await register({ name: "Ada", email: "a@b.com", password: "password123" });

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/customer/register`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Ada", email: "a@b.com", password: "password123" }),
      }),
    );
  });

  it("returns the session from verify-otp", async () => {
    const session = { token: "t", customer: { id: "1", email: "a@b.com", name: "Ada", phone: null, profilePictureUrl: null } };
    mockFetch.mockResolvedValue(jsonResponse(session));

    await expect(verifyOtp({ email: "a@b.com", code: "123456" })).resolves.toEqual(session);
  });

  it("returns the server's message from resend-otp", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: "If an unverified account exists…" }));

    await expect(resendOtp({ email: "a@b.com" })).resolves.toEqual({
      message: "If an unverified account exists…",
    });
  });

  it("returns the session on a successful login", async () => {
    const session = { token: "t", customer: { id: "1", email: "a@b.com", name: "Ada", phone: null, profilePictureUrl: null } };
    mockFetch.mockResolvedValue(jsonResponse(session));

    await expect(login({ email: "a@b.com", password: "password123" })).resolves.toEqual(session);
  });

  // The one behaviour this wrapper adds beyond a plain apiFetch call: an unverified-account
  // login failure becomes its own error TYPE, not just a message string, so the login screen can
  // `instanceof` it to decide whether to offer a "verify now" link — see backend/src/routes/
  // customer.ts's `unverified: true` flag on that specific 403.
  it("raises UnverifiedLoginError when the backend flags the account unverified", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ error: "Please verify your email before logging in.", unverified: true }, false, 403),
    );

    await expect(login({ email: "a@b.com", password: "password123" })).rejects.toBeInstanceOf(
      UnverifiedLoginError,
    );
  });

  it("raises a plain error for a wrong password, not UnverifiedLoginError", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: "Invalid email or password" }, false, 401));

    const result = login({ email: "a@b.com", password: "wrong" });
    await expect(result).rejects.toThrow("Invalid email or password");
    await expect(result).rejects.not.toBeInstanceOf(UnverifiedLoginError);
  });

  it("returns the server's generic message from forgot-password", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: "If an account exists…" }));

    await expect(forgotPassword({ email: "a@b.com" })).resolves.toEqual({ message: "If an account exists…" });
  });

  it("posts the reset fields to /api/customer/reset-password", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ message: "Password reset." }));

    await resetPassword({ email: "a@b.com", code: "123456", newPassword: "newpassword1" });

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/customer/reset-password`,
      expect.objectContaining({
        body: JSON.stringify({ email: "a@b.com", code: "123456", newPassword: "newpassword1" }),
      }),
    );
  });
});
