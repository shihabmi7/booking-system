import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// Both endpoints below require a logged-in staff/admin user — these are internal,
// business-management screens, not anything a customer needs.

// GET /api/resources — list every resource for the caller's OWN business only.
// Useful for an admin screen or picking a resourceId without going through /api/services.
router.get("/", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const resources = await prisma.resource.findMany({
    where: { businessId: req.user!.businessId },
    include: { business: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  res.json(resources);
});

// PATCH /api/resources/:id — update working hours and/or weekly closed days. ADMIN only —
// changing business hours is a bigger deal than the read-only GET above, which any staff
// member can do. Only the fields provided in the body are changed; omitted fields are left as-is.
router.patch("/:id", requireAuth, requireRole(UserRole.ADMIN), async (req, res) => {
  const { workingHoursStart, workingHoursEnd, closedWeekdays } = req.body;

  if (workingHoursStart !== undefined && !/^\d{2}:\d{2}$/.test(workingHoursStart)) {
    return res.status(400).json({ error: "workingHoursStart must be in HH:MM format" });
  }
  if (workingHoursEnd !== undefined && !/^\d{2}:\d{2}$/.test(workingHoursEnd)) {
    return res.status(400).json({ error: "workingHoursEnd must be in HH:MM format" });
  }
  if (
    closedWeekdays !== undefined &&
    (!Array.isArray(closedWeekdays) || !closedWeekdays.every((d) => Number.isInteger(d) && d >= 0 && d <= 6))
  ) {
    return res.status(400).json({ error: "closedWeekdays must be an array of integers 0-6 (0 = Sunday)" });
  }

  // Ownership check: an admin can only edit resources belonging to THEIR OWN business, even
  // though they're authenticated and hold the ADMIN role. Role alone (authZ by "what can this
  // role do") isn't enough in a multi-tenant schema — this is authZ by "does this specific
  // record belong to this specific caller," a different and easy-to-forget check.
  const resource = await prisma.resource.findUnique({ where: { id: req.params.id } });
  if (!resource) return res.status(404).json({ error: "Resource not found" });
  if (resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this resource" });
  }

  const updated = await prisma.resource.update({
    where: { id: req.params.id },
    data: { workingHoursStart, workingHoursEnd, closedWeekdays },
  });
  res.json(updated);
});

export default router;
