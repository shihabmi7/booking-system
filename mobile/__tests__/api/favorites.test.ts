import { addFavorite, getFavorites, removeFavorite } from "@/api/favorites";

describe("getFavorites", () => {
  it("delegates to the given authedFetch against /api/favorites", async () => {
    const favorites = [{ id: "1", favoritedAt: "2026-01-01T00:00:00.000Z" }];
    const authedFetch = jest.fn().mockResolvedValue(favorites);

    await expect(getFavorites(authedFetch)).resolves.toBe(favorites);
    expect(authedFetch).toHaveBeenCalledWith("/api/favorites");
  });
});

describe("addFavorite", () => {
  it("POSTs the serviceId", async () => {
    const authedFetch = jest.fn().mockResolvedValue({ favoritedAt: "2026-01-01T00:00:00.000Z" });

    await addFavorite(authedFetch, "svc-1");

    expect(authedFetch).toHaveBeenCalledWith(
      "/api/favorites",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ serviceId: "svc-1" }) }),
    );
  });
});

describe("removeFavorite", () => {
  it("DELETEs by serviceId in the path", async () => {
    const authedFetch = jest.fn().mockResolvedValue({ removed: 1 });

    await removeFavorite(authedFetch, "svc-1");

    expect(authedFetch).toHaveBeenCalledWith("/api/favorites/svc-1", expect.objectContaining({ method: "DELETE" }));
  });
});
