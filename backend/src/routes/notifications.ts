import { Router } from "express";
import { prisma } from "../db/prisma";
import { requireCustomerAuth } from "../middleware/customerAuth";

const router = Router();

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// GET /api/notifications?cursor=<id>&limit=20&unreadOnly=true
// The customer's own notification list, newest first.
//
// Cursor pagination rather than page/offset: this list grows at the top (a new notification
// arrives while the customer is scrolling), and offset paging would then re-serve an item
// they already saw. A cursor anchored to a row is stable against inserts above it.
router.get("/", requireCustomerAuth, async (req, res) => {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
  const unreadOnly = req.query.unreadOnly === "true";

  const notifications = await prisma.notification.findMany({
    where: { customerId: req.customer!.customerId, ...(unreadOnly ? { readAt: null } : {}) },
    // Fetch one extra row to learn whether another page exists, without a second count query.
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      data: true,
      readAt: true,
      createdAt: true,
      bookingId: true,
      booking: { select: { bookingRef: true, startTime: true, status: true } },
    },
  });

  const hasMore = notifications.length > limit;
  const items = hasMore ? notifications.slice(0, limit) : notifications;
  res.json({ items, nextCursor: hasMore ? items[items.length - 1].id : null });
});

// GET /api/notifications/unread-count — drives the badge on the app's bell icon. Split out
// from the list endpoint because the app polls this far more often than it loads the list,
// and a COUNT over the (customerId, createdAt) index is much cheaper than fetching rows.
//
// Registered BEFORE /:id/read below — Express matches routes in order, and a literal path
// declared after a parameterized one that could also match it would never be reached.
router.get("/unread-count", requireCustomerAuth, async (req, res) => {
  const count = await prisma.notification.count({
    where: { customerId: req.customer!.customerId, readAt: null },
  });
  res.json({ count });
});

// POST /api/notifications/:id/read — marks one notification read.
router.post("/:id/read", requireCustomerAuth, async (req, res) => {
  // updateMany with customerId in the WHERE, rather than update-by-id, so ownership is
  // enforced by the query itself — there's no window where another customer's row is fetched
  // and then checked. count === 0 covers both "doesn't exist" and "isn't yours", which is
  // also the right thing to leak: neither case tells the caller anything about other rows.
  const result = await prisma.notification.updateMany({
    where: { id: req.params.id, customerId: req.customer!.customerId, readAt: null },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    const exists = await prisma.notification.findFirst({
      where: { id: req.params.id, customerId: req.customer!.customerId },
      select: { id: true, readAt: true },
    });
    // Already read — idempotent success, not an error. Retrying on a flaky connection
    // shouldn't produce a failure the app has to explain to the user.
    if (exists) return res.json({ id: exists.id, readAt: exists.readAt });
    return res.status(404).json({ error: "Notification not found" });
  }

  res.json({ id: req.params.id, readAt: new Date() });
});

// POST /api/notifications/read-all — clears the badge in one call.
router.post("/read-all", requireCustomerAuth, async (req, res) => {
  const result = await prisma.notification.updateMany({
    where: { customerId: req.customer!.customerId, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ updated: result.count });
});

export default router;
