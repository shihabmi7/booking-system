import { Router } from "express";
import { prisma } from "../db/prisma";

const router = Router();

// GET /api/health -> basic liveness + DB connectivity check.
// This is the first endpoint the frontend calls to prove the two apps talk to each other.
router.get("/", async (_req, res) => {
  let dbConnected = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  res.json({
    status: "ok",
    dbConnected,
    timestamp: new Date().toISOString(),
  });
});

export default router;
