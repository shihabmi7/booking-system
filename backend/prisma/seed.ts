import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BUSINESS_NAME = "Sunrise Family Clinic";

// Seeds one sample business with one resource and two services, so there's real
// data to query via GET /api/services. Also seeds a weekly closed day and a one-off
// holiday, to demonstrate the closure logic in services/availability.ts.
//
// Idempotent by design: checks for an existing business with this name first and skips
// seeding if found, instead of blindly `create`-ing every time. Without this check, running
// `npm run seed` more than once (easy to do by accident — e.g. after every migration) creates
// a brand new duplicate business/resource/services each time, which is exactly what happened
// and showed up as duplicate rows on the /services page.
//
// Run with: npm run seed
async function main() {
  const existing = await prisma.business.findFirst({ where: { name: BUSINESS_NAME } });
  if (existing) {
    console.log(`Skipping seed — "${BUSINESS_NAME}" already exists (id: ${existing.id}).`);
    return;
  }

  const business = await prisma.business.create({
    data: {
      name: BUSINESS_NAME,
      timezone: "Asia/Dhaka",
      resources: {
        create: [
          {
            name: "Dr. Ayesha Rahman",
            workingHoursStart: "09:00",
            workingHoursEnd: "17:00",
            // 5 = Friday. Weekly day off for this resource, regardless of Holiday rows.
            closedWeekdays: [5],
            services: {
              create: [
                { name: "General Consultation", durationMins: 20, price: 500 },
                { name: "Follow-up Visit", durationMins: 15, price: 300 },
              ],
            },
          },
        ],
      },
      holidays: {
        create: [
          {
            // A near-future date so it's easy to test against right after seeding.
            date: new Date("2026-08-29"),
            reason: "Staff Training Day",
          },
        ],
      },
    },
  });

  console.log(`Seeded business: ${business.name}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
