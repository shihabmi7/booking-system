import { UserRole } from "@prisma/client";
import { prisma } from "../../src/db/prisma";
import { hashPassword, signToken } from "../../src/services/auth";
import { signCustomerToken } from "../../src/services/customerAuth";

// One place to build the "business + resource + service" tree every booking-related test
// needs — mirrors prisma/seed.ts's shape (a clinic with one provider and a couple of
// services) but scoped per-test instead of shared, since resetDb() wipes it between tests.
export async function createBusinessWithService(overrides?: { durationMins?: number; closedWeekdays?: number[] }) {
  const business = await prisma.business.create({
    data: { name: "Test Clinic", timezone: "UTC" },
  });
  const resource = await prisma.resource.create({
    data: {
      name: "Test Provider",
      businessId: business.id,
      workingHoursStart: "09:00",
      workingHoursEnd: "17:00",
      closedWeekdays: overrides?.closedWeekdays ?? [],
    },
  });
  const service = await prisma.service.create({
    data: {
      name: "Test Service",
      durationMins: overrides?.durationMins ?? 30,
      price: 100,
      resourceId: resource.id,
    },
  });
  return { business, resource, service };
}

// Bypasses the password login flow — signs a real token with the real signing function
// (services/auth.ts), which is what actually matters for testing routes that consume it.
// Going through POST /api/auth/login in every test that just needs "a valid staff token"
// would be redundant with auth.test.ts, which is where the login flow itself gets exercised.
export async function createStaffUser(businessId: string, role: UserRole = UserRole.STAFF) {
  const passwordHash = await hashPassword("StaffPass123!");
  const user = await prisma.user.create({
    data: { email: `staff-${Date.now()}-${Math.random()}@test.local`, passwordHash, role, businessId },
  });
  const token = signToken({ userId: user.id, role: user.role, businessId: user.businessId });
  return { user, token };
}

// Same "skip the flow, sign a real token" approach as createStaffUser — the OTP-verify flow
// itself belongs to customer-auth-focused tests, not every test that just needs a logged-in
// customer. emailVerifiedAt is set directly since booking creation requires a verified account.
export async function createCustomer(overrides?: { name?: string; email?: string }) {
  const passwordHash = await hashPassword("CustomerPass123!");
  const customer = await prisma.customer.create({
    data: {
      email: overrides?.email ?? `customer-${Date.now()}-${Math.random()}@test.local`,
      passwordHash,
      name: overrides?.name ?? "Test Customer",
      emailVerifiedAt: new Date(),
    },
  });
  const token = signCustomerToken({ customerId: customer.id, email: customer.email });
  return { customer, token };
}

// A startTime that's always safely in the future relative to "now", inside the test
// resource's 09:00-17:00 working window, and never a weekend — Saturday/Sunday would be
// closed by default in some tests' closedWeekdays overrides. Callers needing a specific time
// slot instead of "any valid one" build the Date themselves.
export function nextWeekdayAt(hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + 7); // a week out — clear of "today's slots already elapsed"
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  date.setHours(hour, minute, 0, 0);
  return date;
}
