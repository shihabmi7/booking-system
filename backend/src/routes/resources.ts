import { Router } from "express";
import { prisma } from "../db/prisma";

const router = Router();

// NOTE: like holidays.ts, this PATCH endpoint is unauthenticated for now — needs to be
// gated behind staff/admin auth once Phase 5 lands.

// GET /api/resources — list every resource, useful for an admin screen or picking a
// resourceId without having to go through /api/services first.
router.get("/", async (_req, res) => {
  const resources = await prisma.resource.findMany({
    include: { business: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  res.json(resources);
});

// PATCH /api/resources/:id — update working hours and/or weekly closed days.
// Only the fields provided in the body are changed; omitted fields are left as-is.
router.patch("/:id", async (req, res) => {
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

  try {
    const resource = await prisma.resource.update({
      where: { id: req.params.id },
      data: { workingHoursStart, workingHoursEnd, closedWeekdays },
    });
    res.json(resource);
  } catch {
    res.status(404).json({ error: "Resource not found" });
  }
});

export default router;
