import { createBooking, getBooking, getMyBookings } from "@/api/bookings";
import { API_BASE_URL } from "@/api/config";

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("createBooking", () => {
  it("delegates to the given authedFetch with the booking body", async () => {
    const booking = { id: "1", bookingRef: "ref-1" };
    const authedFetch = jest.fn().mockResolvedValue(booking);

    const result = await createBooking(authedFetch, {
      resourceId: "res-1",
      serviceId: "svc-1",
      startTime: "2026-01-15T10:00:00.000Z",
      idempotencyKey: "key-1",
    });

    expect(result).toBe(booking);
    expect(authedFetch).toHaveBeenCalledWith(
      "/api/bookings",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          resourceId: "res-1",
          serviceId: "svc-1",
          startTime: "2026-01-15T10:00:00.000Z",
          idempotencyKey: "key-1",
        }),
      }),
    );
  });
});

describe("getMyBookings", () => {
  it("delegates to the given authedFetch against /api/customer/bookings", async () => {
    const bookings = [{ id: "1" }];
    const authedFetch = jest.fn().mockResolvedValue(bookings);

    await expect(getMyBookings(authedFetch)).resolves.toBe(bookings);
    expect(authedFetch).toHaveBeenCalledWith("/api/customer/bookings");
  });
});

describe("getBooking", () => {
  beforeEach(() => mockFetch.mockReset());

  it("is a public lookup with no auth header", async () => {
    const booking = { id: "1", bookingRef: "ref-1", qrCode: "data:image/png;base64,abc" };
    mockFetch.mockResolvedValue(jsonResponse(booking));

    await expect(getBooking("ref-1")).resolves.toEqual(booking);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/bookings/ref-1`, expect.anything());
    expect(mockFetch.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });
});
