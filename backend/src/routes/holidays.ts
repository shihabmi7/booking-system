import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/holidays — list holidays for the CALLER'S OWN business. No businessId param
// needed (or trusted) anymore — scoping to req.user.businessId is both simpler and safer
// than accepting a businessId from the client and hoping it matches who's logged in.
router.get("/", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const holidays = await prisma.holiday.findMany({
    where: { businessId: req.user!.businessId },
    orderBy: { date: "asc" },
  });
  res.json(holidays);
});

// POST /api/holidays — add a one-off closed date. ADMIN only. Always scoped to the
// admin's own business, same reasoning as the GET above.
router.post("/", requireAuth, requireRole(UserRole.ADMIN), async (req, res) => {
  const { date, reason } = req.body;

  if (!date) {
    return res.status(400).json({ error: "date is required" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
  }

  try {
    const holiday = await prisma.holiday.create({
      data: { businessId: req.user!.businessId, date: new Date(date), reason },
    });
    res.status(201).json(holiday);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return res.status(409).json({ error: "A holiday already exists for this business on that date" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to create holiday" });
  }
});

// DELETE /api/holidays/:id — remove a holiday. ADMIN only, and only if it belongs to the
// admin's own business (an ownership check, not just a role check — see resources.ts for
// the longer version of this comment).
router.delete("/:id", requireAuth, requireRole(UserRole.ADMIN), async (req, res) => {
  const holiday = await prisma.holiday.findUnique({ where: { id: req.params.id } });
  if (!holiday) return res.status(404).json({ error: "Holiday not found" });
  if (holiday.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this holiday" });
  }

  await prisma.holiday.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
