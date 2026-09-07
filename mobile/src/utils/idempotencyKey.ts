// Not cryptographically random on purpose — this only needs to be unique enough that two
// genuinely different booking attempts never collide, not unguessable. Good enough for a value
// that only ever gets compared against itself (see backend/src/services/bookingCreation.ts's
// idempotencyKey lookup), so no crypto dependency is worth pulling in for it.
export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
