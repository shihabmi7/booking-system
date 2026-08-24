import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seeds one sample business with one resource and two services, so there's real
// data to query via GET /api/services. Run with: npm run seed
async function main() {
  const business = await prisma.business.create({
    data: {
      name: "Sunrise Family Clinic",
      timezone: "Asia/Dhaka",
      resources: {
        create: [
          {
            name: "Dr. Ayesha Rahman",
            workingHoursStart: "09:00",
            workingHoursEnd: "17:00",
            services: {
              create: [
                { name: "General Consultation", durationMins: 20, price: 500 },
                { name: "Follow-up Visit", durationMins: 15, price: 300 },
              ],
            },
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
