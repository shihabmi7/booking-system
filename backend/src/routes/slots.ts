import { Router } from "express";
import { getAvailableSlots } from "../services/availability";

const router = Router();

// GET /api/slots?resourceId=...&serviceId=...&date=YYYY-MM-DD
// Returns only the open slots for that resource+service+date — combines the resource's
// working hours with existing bookings so the frontend never has to do that math itself.
router.get("/", async (req, res) => {
  const { resourceId, serviceId, date } = req.query;

  if (typeof resourceId !== "string" || typeof serviceId !== "string" || typeof date !== "string") {
    return res.status(400).json({ error: "resourceId, serviceId, and date are all required query params" });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "date must be in YYYY-MM-DD format" });
  }

  const result = await getAvailableSlots(resourceId, serviceId, date);

  if (!result.ok) {
    return res.status(404).json({ error: result.error });
  }

  // Response is an object (not a bare array) so a fully-closed day can carry a `note`
  // explaining why — e.g. "Closed: Eid holiday" instead of just an empty list with no context.
  res.json({
    slots: result.slots.map((slot) => ({
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
    })),
    note: result.note,
  });
});

export default router;
