import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { createBooking } from "../services/bookingCreation";
import { cancelBooking, rescheduleBooking } from "../services/bookingLifecycle";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// GET /api/staff/customers?search=... — lets staff find an existing customer by name, email,
// or phone before creating a booking for them (see POST /bookings below), instead of always
// falling back to a nameless walk-in entry.
//
// Known limitation: Customer isn't scoped to a Business (see schema.prisma's comment on the
// model — a customer account is meant to work across businesses if this ever becomes a real
// multi-tenant product), so this search currently returns matches across ALL businesses, not
// just people who've booked with this one. Fine for the single-business MVP this project
// targets; a real multi-tenant version would need to scope this through existing Bookings at
// the caller's own business (or a dedicated CustomerBusiness join table) before search results
// could safely include another business's customer's contact details.
router.get("/customers", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  if (!search) return res.json([]);

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, email: true, phone: true },
    take: 10,
    orderBy: { name: "asc" },
  });

  res.json(customers);
});

// POST /api/staff/bookings — staff create a booking on behalf of someone, either an existing
// customer (by id, found via the search above) or a walk-in with no account at all. This is
// the one place customer contact info still gets typed directly into a request body — the
// customer self-service endpoint (POST /api/bookings) never trusts client-submitted contact
// info, but here the "client" IS staff vouching for who's in front of them.
router.post("/bookings", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const { resourceId, serviceId, startTime, idempotencyKey, customerId, customerName, customerPhone } = req.body;

  if (!resourceId) {
    return res.status(400).json({ error: "resourceId is required" });
  }

  // Ownership check: staff can only book against a resource in their own business — same
  // principle as every other staff-facing endpoint (resources, holidays, queue).
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) return res.status(404).json({ error: "Resource not found" });
  if (resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this resource" });
  }

  let name: string;
  let phone: string | null = null;
  let email: string | null = null;
  let resolvedCustomerId: string | null = null;

  if (customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    resolvedCustomerId = customer.id;
    name = customer.name;
    phone = customer.phone;
    email = customer.email;
  } else {
    // Walk-in: no account, so customerId stays null on the booking (same nullable field that
    // covers pre-customer-accounts legacy bookings — see schema.prisma's comment on it).
    if (!customerName) {
      return res.status(400).json({ error: "customerId or customerName is required" });
    }
    name = customerName;
    phone = customerPhone || null;
  }

  try {
    const result = await createBooking({
      resourceId,
      serviceId,
      startTime,
      idempotencyKey,
      customerId: resolvedCustomerId,
      customerName: name,
      customerPhone: phone,
      customerEmail: email,
    });
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.status(result.status).json(result.booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// POST /api/staff/bookings/:bookingRef/cancel — staff cancelling any booking (a customer's or
// a walk-in's) at their own business. Ownership check is by businessId here, not customerId —
// the customer-facing equivalent (routes/bookings.ts) checks the opposite.
router.post("/bookings/:bookingRef/cancel", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const booking = await prisma.booking.findUnique({
    where: { bookingRef: req.params.bookingRef },
    include: { resource: { select: { businessId: true } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this booking" });
  }

  const result = await cancelBooking(req.params.bookingRef);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json(result.booking);
});

// PATCH /api/staff/bookings/:bookingRef/reschedule — staff moving any booking at their
// business to a new time on the same service/resource. Body: { startTime }.
router.patch("/bookings/:bookingRef/reschedule", requireAuth, requireRole(UserRole.STAFF, UserRole.ADMIN), async (req, res) => {
  const { startTime } = req.body ?? {};
  if (typeof startTime !== "string") {
    return res.status(400).json({ error: "startTime is required" });
  }

  const booking = await prisma.booking.findUnique({
    where: { bookingRef: req.params.bookingRef },
    include: { resource: { select: { businessId: true } } },
  });
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  if (booking.resource.businessId !== req.user!.businessId) {
    return res.status(403).json({ error: "You don't have access to this booking" });
  }

  const result = await rescheduleBooking(req.params.bookingRef, startTime);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json(result.booking);
});

export default router;
