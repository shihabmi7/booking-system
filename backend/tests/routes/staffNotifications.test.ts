import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { resetDb } from "../helpers/db";
import { createBusinessWithService, createCustomer, createStaffUser } from "../helpers/factories";

beforeEach(resetDb);

describe("GET/PATCH /api/staff/notifications/settings", () => {
  it("defaults to the documented reminder offsets (6h and 1h) on first read", async () => {
    const { business } = await createBusinessWithService();
    const { token } = await createStaffUser(business.id);

    const res = await request(app).get("/api/staff/notifications/settings").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.reminderOffsetsMins).toEqual([360, 60]);
    expect(res.body.remindersEnabled).toBe(true);
  });

  it("lets an ADMIN update settings, sorted furthest-out first", async () => {
    const { business } = await createBusinessWithService();
    const { token } = await createStaffUser(business.id, "ADMIN");

    const res = await request(app)
      .patch("/api/staff/notifications/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ reminderOffsetsMins: [60, 1440, 360] });

    expect(res.status).toBe(200);
    expect(res.body.reminderOffsetsMins).toEqual([1440, 360, 60]);
  });

  it("rejects a PATCH from a non-admin STAFF user", async () => {
    const { business } = await createBusinessWithService();
    const { token } = await createStaffUser(business.id, "STAFF");

    const res = await request(app)
      .patch("/api/staff/notifications/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ remindersEnabled: false });

    expect(res.status).toBe(403);
  });

  it("rejects an invalid quiet-hours time format with 400 and doesn't persist it", async () => {
    const { business } = await createBusinessWithService();
    const { token } = await createStaffUser(business.id, "ADMIN");

    const bad = await request(app)
      .patch("/api/staff/notifications/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ quietHoursStart: "22:00", quietHoursEnd: "not-a-time" });
    expect(bad.status).toBe(400);

    const after = await request(app).get("/api/staff/notifications/settings").set("Authorization", `Bearer ${token}`);
    expect(after.body.quietHoursStart).toBeNull();
  });
});

describe("POST /api/staff/notifications (send a message)", () => {
  it("stores a notification for each recipient and reports per-customer results", async () => {
    const { business } = await createBusinessWithService();
    const { token } = await createStaffUser(business.id);
    const { customer } = await createCustomer();

    const res = await request(app)
      .post("/api/staff/notifications")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerIds: [customer.id], title: "Reminder", body: "Please bring your ID." });

    expect(res.status).toBe(201);
    expect(res.body.sent).toBe(1);
    expect(res.body.results[0]).toMatchObject({ customerId: customer.id, sent: true });
  });

  it("rejects the batch entirely if any customer id is unknown — no partial send", async () => {
    const { business } = await createBusinessWithService();
    const { token } = await createStaffUser(business.id);
    const { customer } = await createCustomer();

    const res = await request(app)
      .post("/api/staff/notifications")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerIds: [customer.id, "00000000-0000-0000-0000-000000000000"], title: "Hi", body: "Test" });

    expect(res.status).toBe(400);
    expect(res.body.unknown).toEqual(["00000000-0000-0000-0000-000000000000"]);
  });

  it("rejects an empty title", async () => {
    const { business } = await createBusinessWithService();
    const { token } = await createStaffUser(business.id);
    const { customer } = await createCustomer();

    const res = await request(app)
      .post("/api/staff/notifications")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerIds: [customer.id], title: "", body: "Test" });

    expect(res.status).toBe(400);
  });

  it("shows up in GET /sent afterward, scoped to the customer filter", async () => {
    const { business } = await createBusinessWithService();
    const { token } = await createStaffUser(business.id);
    const { customer } = await createCustomer();

    await request(app)
      .post("/api/staff/notifications")
      .set("Authorization", `Bearer ${token}`)
      .send({ customerIds: [customer.id], title: "Hi", body: "Test" });

    const sent = await request(app)
      .get(`/api/staff/notifications/sent?customerId=${customer.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(sent.status).toBe(200);
    expect(sent.body).toHaveLength(1);
    expect(sent.body[0].title).toBe("Hi");
  });
});
