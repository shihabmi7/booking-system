import { Router } from "express";
import { prisma } from "../db/prisma";

const router = Router();

// GET /api/services -> lists every service across all resources/businesses.
// This is Phase 2's end-to-end proof that the Prisma schema, migration, and
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

export default router;
