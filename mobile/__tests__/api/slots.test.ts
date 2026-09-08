import { getSlots } from "@/api/slots";
import { API_BASE_URL } from "@/api/config";

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as Response;
}

describe("getSlots", () => {
  beforeEach(() => mockFetch.mockReset());

  it("builds the query string from resourceId, serviceId, and date", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ slots: [] }));

    await getSlots("res-1", "svc-1", "2026-01-15");

    expect(mockFetch).toHaveBeenCalledWith(
      `${API_BASE_URL}/api/slots?resourceId=res-1&serviceId=svc-1&date=2026-01-15`,
      expect.anything(),
    );
  });

  it("passes through a closure note alongside an empty slot list", async () => {
    mockFetch.mockResolvedValue(jsonResponse({ slots: [], note: "Closed: public holiday" }));

    await expect(getSlots("res-1", "svc-1", "2026-01-15")).resolves.toEqual({
      slots: [],
      note: "Closed: public holiday",
    });
  });
});
