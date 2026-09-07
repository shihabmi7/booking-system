type AuthedFetch = <T>(path: string, init?: RequestInit) => Promise<T>;

// Matches GET /api/favorites' shape (backend/src/routes/favorites.ts) — the favorited Service
// itself plus when it was favorited, so this can reuse the same row shape/renderer the plain
// services list uses instead of being a separate presentation of the same data.
export type FavoriteService = {
  id: string;
  name: string;
  durationMins: number;
  price: string;
  favoritedAt: string;
  resource: { name: string; business: { name: string } };
};

export function getFavorites(authedFetch: AuthedFetch): Promise<FavoriteService[]> {
  return authedFetch<FavoriteService[]>("/api/favorites");
}

// POST /api/favorites — upsert server-side, so favoriting something already favorited (a
// double-tap, or two devices) is a no-op rather than an error; nothing to special-case here.
export function addFavorite(authedFetch: AuthedFetch, serviceId: string): Promise<{ favoritedAt: string }> {
  return authedFetch("/api/favorites", { method: "POST", body: JSON.stringify({ serviceId }) });
}

// DELETE /api/favorites/:serviceId — deleteMany server-side, so removing something that isn't
// favorited (already removed elsewhere) is also a fine outcome, not a 404 to handle.
export function removeFavorite(authedFetch: AuthedFetch, serviceId: string): Promise<{ removed: number }> {
  return authedFetch(`/api/favorites/${serviceId}`, { method: "DELETE" });
}
