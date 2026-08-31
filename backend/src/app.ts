import path from "path";
import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import servicesRouter from "./routes/services";
import slotsRouter from "./routes/slots";
import bookingsRouter from "./routes/bookings";
import holidaysRouter from "./routes/holidays";
import resourcesRouter from "./routes/resources";
import queueRouter from "./routes/queue";
import authRouter from "./routes/auth";
import dashboardRouter from "./routes/dashboard";
import customerRouter from "./routes/customer";
import staffBookingsRouter from "./routes/staffBookings";
import devicesRouter from "./routes/devices";
import notificationsRouter from "./routes/notifications";
import staffNotificationsRouter from "./routes/staffNotifications";
import favoritesRouter from "./routes/favorites";

// The Express app itself, split out from index.ts so it can be imported without also binding
// a port — index.ts (the real process entrypoint) is the only thing that calls app.listen(),
// and tests/setup.ts imports THIS file directly with supertest instead. Nothing in here reads
// process.env at import time (dotenv.config() stays in index.ts, run before either this or the
// scheduler is imported), so importing app.ts alone never has a "forgot to load .env" surprise.
const app = express();

app.use(cors());
app.use(express.json());
// Serves uploaded profile pictures (see services/upload.ts) as plain static files —
// /uploads/profile-pictures/<filename>. Local-disk-only for now; Phase 6 swaps this for S3.
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.use("/api/health", healthRouter);
app.use("/api/services", servicesRouter);
app.use("/api/slots", slotsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/api/resources", resourcesRouter);
app.use("/api/queue", queueRouter);
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/customer", customerRouter);
app.use("/api/devices", devicesRouter);
app.use("/api/notifications", notificationsRouter);
app.use("/api/favorites", favoritesRouter);
app.use("/api/staff", staffBookingsRouter);
// Mounted AFTER staffBookingsRouter but on a deeper path, so the two never collide:
// staffBookingsRouter owns /api/staff/customers and /api/staff/bookings, this owns
// everything under /api/staff/notifications.
app.use("/api/staff/notifications", staffNotificationsRouter);

export default app;
