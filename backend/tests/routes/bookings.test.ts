import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { resetDb } from "../helpers/db";
import { createBusinessWithService, createCustomer, createStaffUser, nextWeekdayAt } from "../helpers/factories";

beforeEach(resetDb);

describe("POST /api/bookings (customer self-booking)", () => {
  it("creates a booking for the logged-in customer at an open slot", async () => {
    const { resource, service } = await createBusinessWithService();
    const { customer, token } = await createCustomer();
    const startTime = nextWeekdayAt(10);

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ resourceId: resource.id, serviceId: service.id, startTime: startTime.toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("BOOKED");
    expect(res.body.customerId).toBe(customer.id);
    expect(res.body.qrCode).toMatch(/^data:image\/png;base64,/);
  });

  it("returns 409 when the same resource+time is already booked", async () => {
    const { resource, service } = await createBusinessWithService();
    const { token: tokenA } = await createCustomer({ email: "a@test.local" });
    const { token: tokenB } = await createCustomer({ email: "b@test.local" });
    const startTime = nextWeekdayAt(11);

    const first = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ resourceId: resource.id, serviceId: service.id, startTime: startTime.toISOString() });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ resourceId: resource.id, serviceId: service.id, startTime: startTime.toISOString() });
    expect(second.status).toBe(409);
  });

  it("rejects an unauthenticated request", async () => {
    const { resource, service } = await createBusinessWithService();
    const res = await request(app)
      .post("/api/bookings")
      .send({ resourceId: resource.id, serviceId: service.id, startTime: nextWeekdayAt(9).toISOString() });
    expect(res.status).toBe(401);
  });

  it("returns 404 for a service that doesn't belong to the given resource", async () => {
    const { resource } = await createBusinessWithService();
    const other = await createBusinessWithService();
    const { token } = await createCustomer();

    const res = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ resourceId: resource.id, serviceId: other.service.id, startTime: nextWeekdayAt(9).toISOString() });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/bookings/:bookingRef/cancel (customer)", () => {
  async function bookAsCustomer() {
    const { resource, service } = await createBusinessWithService();
    const { customer, token } = await createCustomer();
    const startTime = nextWeekdayAt(10);
    const created = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ resourceId: resource.id, serviceId: service.id, startTime: startTime.toISOString() });
    return { booking: created.body, customer, token };
  }

  it("lets the owning customer cancel their own BOOKED appointment", async () => {
    const { booking, token } = await bookAsCustomer();

    const res = await request(app)
      .post(`/api/bookings/${booking.bookingRef}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
  });

  it("returns 403 when a different customer tries to cancel it", async () => {
    const { booking } = await bookAsCustomer();
    const { token: otherToken } = await createCustomer({ email: "someone-else@test.local" });

    const res = await request(app)
      .post(`/api/bookings/${booking.bookingRef}/cancel`)
      .set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it("returns 409 on a second cancel attempt — no double-cancel, and no duplicate notification", async () => {
    const { booking, token } = await bookAsCustomer();
    await request(app).post(`/api/bookings/${booking.bookingRef}/cancel`).set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .post(`/api/bookings/${booking.bookingRef}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/bookings/:bookingRef/reschedule (customer)", () => {
  it("moves the booking to a new open slot on the same resource/service", async () => {
    const { resource, service } = await createBusinessWithService();
    const { token } = await createCustomer();
    const original = nextWeekdayAt(10);
    const created = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ resourceId: resource.id, serviceId: service.id, startTime: original.toISOString() });

    const newTime = nextWeekdayAt(13);
    const res = await request(app)
      .patch(`/api/bookings/${created.body.bookingRef}/reschedule`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startTime: newTime.toISOString() });

    expect(res.status).toBe(200);
    expect(new Date(res.body.startTime).getTime()).toBe(newTime.getTime());
    expect(res.body.status).toBe("BOOKED");
  });

  it("returns 409 when the requested slot is already taken", async () => {
    const { resource, service } = await createBusinessWithService();
    const { token: tokenA } = await createCustomer({ email: "a@test.local" });
    const { token: tokenB } = await createCustomer({ email: "b@test.local" });
    const takenTime = nextWeekdayAt(14);
    const movingTime = nextWeekdayAt(10);

    await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ resourceId: resource.id, serviceId: service.id, startTime: takenTime.toISOString() });

    const toMove = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ resourceId: resource.id, serviceId: service.id, startTime: movingTime.toISOString() });

    const res = await request(app)
      .patch(`/api/bookings/${toMove.body.bookingRef}/reschedule`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ startTime: takenTime.toISOString() });

    expect(res.status).toBe(409);
  });

  it("refuses to reschedule a CANCELLED booking", async () => {
    const { resource, service } = await createBusinessWithService();
    const { token } = await createCustomer();
    const created = await request(app)
      .post("/api/bookings")
      .set("Authorization", `Bearer ${token}`)
      .send({ resourceId: resource.id, serviceId: service.id, startTime: nextWeekdayAt(10).toISOString() });
    await request(app).post(`/api/bookings/${created.body.bookingRef}/cancel`).set("Authorization", `Bearer ${token}`);

    const res = await request(app)
      .patch(`/api/bookings/${created.body.bookingRef}/reschedule`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startTime: nextWeekdayAt(11).toISOString() });

    expect(res.status).toBe(409);
  });
});

describe("staff cancel/reschedule (/api/staff/bookings/:bookingRef/...)", () => {
  it("lets staff cancel a walk-in booking (no customer account) at their own business", async () => {
    const { business, resource, service } = await createBusinessWithService();
    const { token: staffToken } = await createStaffUser(business.id);

    const created = await request(app)
      .post("/api/staff/bookings")
      .set("Authorization", `Bearer ${staffToken}`)
      .send({
        resourceId: resource.id,
        serviceId: service.id,
        startTime: nextWeekdayAt(9).toISOString(),
        customerName: "Walk In",
      });
    expect(created.status).toBe(201);
    expect(created.body.customerId).toBeNull();

    const res = await request(app)
      .post(`/api/staff/bookings/${created.body.bookingRef}/cancel`)
      .set("Authorization", `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");
  });

  it("returns 403 when staff from a DIFFERENT business tries to cancel it", async () => {
    const owning = await createBusinessWithService();
    const { token: owningStaffToken } = await createStaffUser(owning.business.id);
    const outsider = await createBusinessWithService();
    const { token: outsiderStaffToken } = await createStaffUser(outsider.business.id);

    const created = await request(app)
      .post("/api/staff/bookings")
      .set("Authorization", `Bearer ${owningStaffToken}`)
      .send({
        resourceId: owning.resource.id,
        serviceId: owning.service.id,
        startTime: nextWeekdayAt(9).toISOString(),
        customerName: "Walk In",
      });
    expect(created.status).toBe(201);

    // Booking belongs to `owning`'s business — a staff member at `outsider`'s business must
    // not be able to cancel it, even with an otherwise-valid staff token.
    const res = await request(app)
      .post(`/api/staff/bookings/${created.body.bookingRef}/cancel`)
      .set("Authorization", `Bearer ${outsiderStaffToken}`);

    expect(res.status).toBe(403);
  });
});
