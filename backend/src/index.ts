import dotenv from "dotenv";
dotenv.config();

import app from "./app";
import { startReminderScheduler } from "./jobs/reminderScheduler";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Booking system API listening on http://localhost:${PORT}`);
  // Started after the server is listening, not before — if the DB is unreachable the sweep
  // logs and retries on the next tick, rather than blocking the API from ever coming up.
  // Set REMINDERS_ENABLED=false to run an instance that serves the API but sends no
  // reminders (useful when running two copies locally, or in tests).
  if (process.env.REMINDERS_ENABLED !== "false") {
    startReminderScheduler();
  }
});
