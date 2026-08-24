import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import healthRouter from "./routes/health";
import servicesRouter from "./routes/services";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRouter);
app.use("/api/services", servicesRouter);

app.listen(PORT, () => {
  console.log(`Booking system API listening on http://localhost:${PORT}`);
});
