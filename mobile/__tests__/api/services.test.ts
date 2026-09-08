import { getServices } from "@/api/services";
import { API_BASE_URL } from "@/api/config";

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("getServices", () => {
  beforeEach(() => mockFetch.mockReset());

  it("fetches the public services list with no auth header", async () => {
    const services = [{ id: "1", name: "Cut", durationMins: 30, price: "20.00", resourceId: "r1", resource: { name: "Chair 1", business: { name: "Salon" } } }];
    mockFetch.mockResolvedValue(jsonResponse(services));

    await expect(getServices()).resolves.toEqual(services);
    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE_URL}/api/services`, expect.anything());
    expect(mockFetch.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });
});
