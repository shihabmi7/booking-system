import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/dashboard/summary?date=YYYY-MM-DD — the business-level "how's today going" view.
// Unlike GET /api/queue (which is scoped to one resource at a time, for the front-desk
// working one doctor/chair's line), this aggregates across every resource in the caller's
// business — the number an owner/admin actually wants when they open the app in the morning.
// STAFF or ADMIN, same access level as the queue itself. Defaults to "today" if no date given.
router.get("/summary", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const date = typeof req.query.date === "string" ? req.query.date : new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
  }

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const resources = await prisma.resource.findMany({
    where: { businessId: req.user!.businessId },
    select: { id: true },
  });
  const resourceIds = resources.map((r) => r.id);

  const bookings = await prisma.booking.findMany({
    where: {
      resourceId: { in: resourceIds },
      startTime: { gte: dayStart, lte: dayEnd },
    },
    include: {
      service: { select: { name: true, price: true } },
      resource: { select: { name: true } },
    },
    orderBy: { startTime: "asc" },
  });

  const totals = { bookings: 0, booked: 0, checkedIn: 0, completed: 0, noShow: 0, cancelled: 0 };
  let expectedRevenue = 0;
  let completedRevenue = 0;

  for (const booking of bookings) {
    totals.bookings += 1;
    const price = booking.service.price.toNumber();

    switch (booking.status) {
      case "BOOKED":
        totals.booked += 1;
        expectedRevenue += price;
        break;
      case "CHECKED_IN":
        totals.checkedIn += 1;
        expectedRevenue += price;
        break;
      case "COMPLETED":
        totals.completed += 1;
        expectedRevenue += price;
        completedRevenue += price;
        break;
      case "NO_SHOW":
        // Deliberately excluded from expectedRevenue — a no-show is lost business, not
        // revenue still "expected" for the day. Still counted in totals.bookings above.
        totals.noShow += 1;
        break;
      case "CANCELLED":
        totals.cancelled += 1;
        break;
    }
  }

  const now = new Date();
  const nextUp = bookings
    .filter((b) => b.status === "BOOKED" && b.startTime.getTime() >= now.getTime())
    .slice(0, 5)
    .map((b) => ({
      bookingRef: b.bookingRef,
      customerName: b.customerName,
      startTime: b.startTime,
      service: { name: b.service.name },
      resource: { name: b.resource.name },
    }));

  res.json({
    date,
    totals,
    revenue: {
      expected: Math.round(expectedRevenue * 100) / 100,
      completed: Math.round(completedRevenue * 100) / 100,
    },
    nextUp,
  });
});

export default router;
