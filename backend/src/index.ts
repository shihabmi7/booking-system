import dotenv from "dotenv";
dotenv.config();

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

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/services", servicesRouter);
app.use("/api/slots", slotsRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/holidays", holidaysRouter);
app.use("/api/resources", resourcesRouter);
app.use("/api/queue", queueRouter);
app.use("/api/auth", authRouter);
app.use("/api/dashboard", dashboardRouter);

app.listen(PORT, () => {
  console.log(`Booking system API listening on http://localhost:${PORT}`);
});
