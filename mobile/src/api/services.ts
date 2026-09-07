import { apiFetch } from "./client";

// Matches backend/src/routes/services.ts's GET / shape. price is a Prisma Decimal, which
// serializes to a plain string over JSON — never a number, so formatting it is the caller's job
// (see mobile-app-plan.md's currency-formatting note: still an open decision, unresolved here
// same as on web, where it's rendered as a raw `$${price}` string too for now).
export type Service = {
  id: string;
  name: string;
  durationMins: number;
  price: string;
  resourceId: string;
  resource: { name: string; business: { name: string } };
};

// GET /api/services is public/unauthenticated — a customer needs the list before they've
// registered, same reasoning as the web app's BookPage.
export function getServices(): Promise<Service[]> {
  return apiFetch<Service[]>("/api/services");
}
