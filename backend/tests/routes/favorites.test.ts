import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app";
import { resetDb } from "../helpers/db";
import { createBusinessWithService, createCustomer } from "../helpers/factories";

beforeEach(resetDb);

describe("favorites", () => {
  it("starts empty for a customer with no favorites", async () => {
    const { token } = await createCustomer();
    const res = await request(app).get("/api/favorites").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("adds a service to favorites and lists it back with resource/business details", async () => {
    const { service, resource, business } = await createBusinessWithService();
    const { token } = await createCustomer();

    const add = await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ serviceId: service.id });
    expect(add.status).toBe(201);

    const list = await request(app).get("/api/favorites").set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      id: service.id,
      name: service.name,
      resource: { name: resource.name, business: { name: business.name } },
    });
  });

  it("favoriting the same service twice is a no-op, not a duplicate row", async () => {
    const { service } = await createBusinessWithService();
    const { token } = await createCustomer();

    await request(app).post("/api/favorites").set("Authorization", `Bearer ${token}`).send({ serviceId: service.id });
    await request(app).post("/api/favorites").set("Authorization", `Bearer ${token}`).send({ serviceId: service.id });

    const list = await request(app).get("/api/favorites").set("Authorization", `Bearer ${token}`);
    expect(list.body).toHaveLength(1);
  });

  it("404s when favoriting a service id that doesn't exist", async () => {
    const { token } = await createCustomer();
    const res = await request(app)
      .post("/api/favorites")
      .set("Authorization", `Bearer ${token}`)
      .send({ serviceId: "00000000-0000-0000-0000-000000000000" });
    expect(res.status).toBe(404);
  });

  it("removes a favorite, and a repeat removal is a harmless no-op", async () => {
    const { service } = await createBusinessWithService();
    const { token } = await createCustomer();
    await request(app).post("/api/favorites").set("Authorization", `Bearer ${token}`).send({ serviceId: service.id });

    const remove = await request(app).delete(`/api/favorites/${service.id}`).set("Authorization", `Bearer ${token}`);
    expect(remove.status).toBe(200);
    expect(remove.body.removed).toBe(1);

    const removeAgain = await request(app).delete(`/api/favorites/${service.id}`).set("Authorization", `Bearer ${token}`);
    expect(removeAgain.body.removed).toBe(0);

    const list = await request(app).get("/api/favorites").set("Authorization", `Bearer ${token}`);
    expect(list.body).toEqual([]);
  });

  it("one customer's favorites are invisible to another customer", async () => {
    const { service } = await createBusinessWithService();
    const { token: tokenA } = await createCustomer({ email: "a@test.local" });
    const { token: tokenB } = await createCustomer({ email: "b@test.local" });

    await request(app).post("/api/favorites").set("Authorization", `Bearer ${tokenA}`).send({ serviceId: service.id });

    const listB = await request(app).get("/api/favorites").set("Authorization", `Bearer ${tokenB}`);
    expect(listB.body).toEqual([]);
  });

  it("rejects every favorites request with no customer token", async () => {
    const get = await request(app).get("/api/favorites");
    const post = await request(app).post("/api/favorites").send({ serviceId: "any" });
    expect(get.status).toBe(401);
    expect(post.status).toBe(401);
  });
});
