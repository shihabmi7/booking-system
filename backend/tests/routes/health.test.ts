import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../src/app";

// No resetDb/beforeEach here on purpose — this only proves the app boots and every router
// mounts without throwing, which doesn't depend on database contents at all.
describe("GET /api/health", () => {
  it("reports ok with a live database connection", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.dbConnected).toBe(true);
  });
});
