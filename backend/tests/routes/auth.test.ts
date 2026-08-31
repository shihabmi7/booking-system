import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { resetDb } from "../helpers/db";
import { hashPassword } from "../../src/services/auth";
import { prisma } from "../../src/db/prisma";

beforeEach(resetDb);

describe("POST /api/auth/login", () => {
  it("returns a token and the user's role/business on correct credentials", async () => {
    const business = await prisma.business.create({ data: { name: "Clinic", timezone: "UTC" } });
    const passwordHash = await hashPassword("CorrectHorse123!");
    await prisma.user.create({
      data: { email: "staff@clinic.test", passwordHash, role: "STAFF", businessId: business.id },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "staff@clinic.test", password: "CorrectHorse123!" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: "staff@clinic.test", role: "STAFF", businessId: business.id });
  });

  it("rejects the wrong password with 401 and no token", async () => {
    const business = await prisma.business.create({ data: { name: "Clinic", timezone: "UTC" } });
    const passwordHash = await hashPassword("CorrectHorse123!");
    await prisma.user.create({
      data: { email: "staff@clinic.test", passwordHash, role: "STAFF", businessId: business.id },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "staff@clinic.test", password: "WrongPassword!" });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it("rejects an email that doesn't belong to any staff account", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@clinic.test", password: "whatever123" });

    expect(res.status).toBe(401);
  });

  it("a token from this login authorizes a role-gated route (GET /api/dashboard/summary)", async () => {
    const business = await prisma.business.create({ data: { name: "Clinic", timezone: "UTC" } });
    const passwordHash = await hashPassword("CorrectHorse123!");
    await prisma.user.create({
      data: { email: "staff@clinic.test", passwordHash, role: "STAFF", businessId: business.id },
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "staff@clinic.test", password: "CorrectHorse123!" });

    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${login.body.token}`);
    expect(res.status).toBe(200);
  });
});
