import { Router } from "express";
import { prisma } from "../db/prisma";
import { requireCustomerAuth } from "../middleware/customerAuth";

const router = Router();

// GET /api/favorites — the logged-in customer's favorited services, most recently favorited
// first. Same nested shape GET /api/services returns, so the frontend can reuse one row
// renderer between "browse services" and "my favorites".
router.get("/", requireCustomerAuth, async (req, res) => {
  const favorites = await prisma.favoriteService.findMany({
    where: { customerId: req.customer!.customerId },
    include: {
      service: {
        select: {
          id: true,
          name: true,
          durationMins: true,
          price: true,
          resource: { select: { name: true, business: { select: { name: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json(favorites.map((f) => ({ favoritedAt: f.createdAt, ...f.service })));
});

// POST /api/favorites — Body: { serviceId }. Upsert on the (customerId, serviceId) unique
// constraint rather than a findFirst-then-create check — favoriting an already-favorited
// service twice (e.g. a double-click, or two tabs open) is a no-op, not an error.
router.post("/", requireCustomerAuth, async (req, res) => {
  const { serviceId } = req.body ?? {};
  if (typeof serviceId !== "string" || !serviceId) {
    return res.status(400).json({ error: "serviceId is required" });
  }

  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return res.status(404).json({ error: "Service not found" });

  const favorite = await prisma.favoriteService.upsert({
    where: { customerId_serviceId: { customerId: req.customer!.customerId, serviceId } },
    create: { customerId: req.customer!.customerId, serviceId },
    update: {},
  });
  res.status(201).json({ id: favorite.id, serviceId: favorite.serviceId, favoritedAt: favorite.createdAt });
});

// DELETE /api/favorites/:serviceId — deleteMany (not delete-by-id) so un-favoriting something
// that isn't favorited, or was already removed from another tab, is a fine outcome rather
// than a 404 the frontend has to special-case.
router.delete("/:serviceId", requireCustomerAuth, async (req, res) => {
  const result = await prisma.favoriteService.deleteMany({
    where: { customerId: req.customer!.customerId, serviceId: req.params.serviceId },
  });
  res.json({ removed: result.count });
});

export default router;
