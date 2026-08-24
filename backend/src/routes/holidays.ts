import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";

const router = Router();

// NOTE: these endpoints are intentionally unauthenticated for now — anyone can call them.
// That's fine for local development, but they need to be gated behind staff/admin auth
// once Phase 5 lands. Don't expose this API publicly as-is.

// GET /api/holidays?businessId=... — list holidays for a business.
router.get("/", async (req, res) => {
  const { businessId } = req.query;
  if (typeof businessId !== "string") {
    return res.status(400).json({ error: "businessId query param is required" });
  }

  const holidays = await prisma.holiday.findMany({
    where: { businessId },
    orderBy: { date: "asc" },
  });
  res.json(holidays);
});

// POST /api/holidays — add a one-off closed date for a business.
router.post("/", async (req, res) => {
  const { businessId, date, reason } = req.body;

  if (!businessId || !date) {
    return res.status(400).json({ error: "businessId and date are required" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
  }

  try {
    const holiday = await prisma.holiday.create({
      data: { businessId, date: new Date(date), reason },
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

// DELETE /api/holidays/:id — remove a holiday (e.g. it was added by mistake).
router.delete("/:id", async (req, res) => {
  try {
    await prisma.holiday.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return res.status(404).json({ error: "Holiday not found" });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete holiday" });
  }
});

export default router;
