import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/services -> lists every service across all resources/businesses.
// Stays public/unauthenticated on purpose — customers need this to build the booking
// wizard (BookPage) before they've ever logged in, since customers never log in at all.
// This is also Phase 2's end-to-end proof that the Prisma schema, migration, and
// seed data all actually work together — same role the health check played in Phase 1.
router.get("/", async (_req, res) => {
  try {
    const services = await prisma.service.findMany({
      include: {
        resource: {
          select: {
            name: true,
            business: { select: { name: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });
    res.json(services);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

// POST /api/services — create a new service under one of the admin's own resources.
// ADMIN only. The ownership check here is one step removed from the usual pattern:
// Service doesn't have its own businessId column, so we look up the target resourceId's
// business first and compare that instead — otherwise an admin from Business A could
// attach a new service to Business B's resource just by guessing its id.
router.post("/", requireAuth, requireRole(UserRole.ADMIN), async (req, res) => {
  const { resourceId, name, durationMins, price } = req.body;

  if (!resourceId || !name || !durationMins || price === undefined) {
    return res.status(400).json({ error: "resourceId, name, durationMins, and price are required" });
  }
  if (!Number.isInteger(durationMins) || durationMins <= 0) {
    return res.status(400).json({ error: "durationMins must be a positive integer" });
  }
  if (Number.isNaN(Number(price)) || Number(price) < 0) {
    return res.status(400).json({ error: "price must be a non-negative number" });
  }

  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) return res.status(404).json({ error: "Resource not found" });
  if (resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this resource" });
  }

  const service = await prisma.service.create({
    data: { resourceId, name, durationMins, price },
  });
  res.status(201).json(service);
});

// PATCH /api/services/:id — update a service's name/duration/price. ADMIN only, same
// ownership check as POST but via the service's own resource relation.
router.patch("/:id", requireAuth, requireRole(UserRole.ADMIN), async (req, res) => {
  const { name, durationMins, price } = req.body;

  if (durationMins !== undefined && (!Number.isInteger(durationMins) || durationMins <= 0)) {
    return res.status(400).json({ error: "durationMins must be a positive integer" });
  }
  if (price !== undefined && (Number.isNaN(Number(price)) || Number(price) < 0)) {
    return res.status(400).json({ error: "price must be a non-negative number" });
  }

  const service = await prisma.service.findUnique({
    where: { id: req.params.id },
    include: { resource: { select: { businessId: true } } },
  });
  if (!service) return res.status(404).json({ error: "Service not found" });
  if (service.resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this service" });
  }

  const updated = await prisma.service.update({
    where: { id: req.params.id },
    data: { name, durationMins, price },
  });
  res.json(updated);
});

// DELETE /api/services/:id — ADMIN only, same ownership check. A service with existing
// bookings can't be deleted (the DB's foreign key would be left dangling) — Prisma raises
// P2003 for that, which we turn into a clear 409 instead of a raw 500.
router.delete("/:id", requireAuth, requireRole(UserRole.ADMIN), async (req, res) => {
  const service = await prisma.service.findUnique({
    where: { id: req.params.id },
    include: { resource: { select: { businessId: true } } },
  });
  if (!service) return res.status(404).json({ error: "Service not found" });
  if (service.resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this service" });
  }

  try {
    await prisma.service.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return res
        .status(409)
        .json({ error: "This service has existing bookings and can't be deleted." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete service" });
  }
});

export default router;
