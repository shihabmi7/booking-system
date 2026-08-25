import { Router } from "express";
import { prisma } from "../db/prisma";

const router = Router();

const LATE_GRACE_MINUTES = 10;

// GET /api/queue?resourceId=...&date=YYYY-MM-DD
// Staff-facing view: every non-cancelled booking for a resource on a given day, ordered by
// time, with an isLate flag — this is the "who's here, who's next" screen front-desk staff
// would actually use, as opposed to the customer-facing booking flow.
router.get("/", async (req, res) => {
  const { resourceId, date } = req.query;

  if (typeof resourceId !== "string" || typeof date !== "string") {
    return res.status(400).json({ error: "resourceId and date are required query params" });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
  }

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const bookings = await prisma.booking.findMany({
    where: {
      resourceId,
      startTime: { gte: dayStart, lte: dayEnd },
      status: { not: "CANCELLED" },
    },
    include: {
      service: { select: { name: true, durationMins: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const now = new Date();
  const queue = bookings.map((booking) => ({
    ...booking,
    // Only meaningful for bookings still waiting to check in — a checked-in/completed/
    // no-show booking's lateness no longer matters for the live queue view.
    isLate:
      booking.status === "BOOKED" &&
      now.getTime() > booking.startTime.getTime() + LATE_GRACE_MINUTES * 60_000,
  }));

  res.json(queue);
});

export default router;
