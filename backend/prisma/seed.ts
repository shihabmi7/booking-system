import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BUSINESS_NAME = "Sunrise Family Clinic";

// Sample staff/admin login credentials — for local testing only (Postman, the login page).
// Never reuse passwords like this anywhere real; they exist here purely so there's a way
// to log in immediately after seeding, without a chicken-and-egg "how do I create the first
// admin" problem (there's no public registration endpoint — see routes/auth.ts).
const SAMPLE_ACCOUNTS = [
  { email: "admin@sunriseclinic.test", password: "AdminPass123!", role: "ADMIN" as const },
  { email: "staff@sunriseclinic.test", password: "StaffPass123!", role: "STAFF" as const },
];

// Seeds one sample business with one resource and two services, so there's real
// data to query via GET /api/services. Also seeds a weekly closed day and a one-off
// holiday, to demonstrate the closure logic in services/availability.ts, plus one ADMIN
// and one STAFF login for testing Phase 5's auth.
//
// Idempotent by design: checks for existing records first and skips creating them again,
// instead of blindly `create`-ing every time. Without this, running `npm run seed` more than
// once (easy to do by accident) creates duplicate rows — see the git history for the bug
// this caused before the check was added.
//
// Run with: npm run seed
async function main() {
  let business = await prisma.business.findFirst({ where: { name: BUSINESS_NAME } });

  if (business) {
    console.log(`Business already exists (id: ${business.id}) — skipping business/resource/service seed.`);
  } else {
    business = await prisma.business.create({
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

  for (const account of SAMPLE_ACCOUNTS) {
    const existingUser = await prisma.user.findUnique({ where: { email: account.email } });
    if (existingUser) {
      console.log(`User already exists — skipping: ${account.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(account.password, 10);
    await prisma.user.create({
      data: {
        email: account.email,
        passwordHash,
        role: account.role,
        businessId: business.id,
      },
    });
    console.log(`Seeded ${account.role} login: ${account.email} / ${account.password}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
