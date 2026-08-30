import { Router } from "express";
import { DevicePlatform } from "@prisma/client";
import { prisma } from "../db/prisma";
import { requireCustomerAuth } from "../middleware/customerAuth";

const router = Router();

const PLATFORMS = new Set<string>(Object.values(DevicePlatform));

// POST /api/devices — the mobile app calls this right after a successful login, and again
// every time Firebase hands it a new token (onTokenRefresh / getToken on cold start).
// Body: { token, platform: "IOS" | "ANDROID" | "WEB", osVersion?, appVersion?, deviceModel? }
//
// The `token` is the FCM registration token on BOTH platforms — on iOS the app gets it from
// Firebase's getToken(), not from APNs directly (see services/push.ts for why). An app that
// passes a raw APNs device token here would register successfully and then never receive
// anything, so it's worth checking the client is calling the Firebase SDK.
router.post("/", requireCustomerAuth, async (req, res) => {
  const { token, platform, osVersion, appVersion, deviceModel } = req.body ?? {};

  if (typeof token !== "string" || token.trim().length < 20) {
    return res.status(400).json({ error: "A valid FCM registration token is required" });
  }
  if (typeof platform !== "string" || !PLATFORMS.has(platform)) {
    return res.status(400).json({ error: `platform must be one of: ${[...PLATFORMS].join(", ")}` });
  }

  // upsert on `token`, not on (customerId, token) — the crucial case is two accounts sharing
  // one phone. The token identifies the app install, so a second customer logging in must take
  // ownership of it; otherwise the first customer's notifications keep arriving on a device
  // that now belongs to someone else. Re-registering also clears disabledAt, which is how a
  // reinstalled app resurrects a token FCM had previously rejected.
  const device = await prisma.deviceToken.upsert({
    where: { token: token.trim() },
    create: {
      token: token.trim(),
      customerId: req.customer!.customerId,
      platform: platform as DevicePlatform,
      osVersion,
      appVersion,
      deviceModel,
    },
    update: {
      customerId: req.customer!.customerId,
      platform: platform as DevicePlatform,
      osVersion,
      appVersion,
      deviceModel,
      lastSeenAt: new Date(),
      disabledAt: null,
    },
    select: { id: true, platform: true, lastSeenAt: true, createdAt: true },
  });

  res.status(201).json(device);
});

// GET /api/devices — the customer's own registered devices. Mainly a support/debug aid
// ("is this phone actually registered?"); the raw token is never returned.
router.get("/", requireCustomerAuth, async (req, res) => {
  const devices = await prisma.deviceToken.findMany({
    where: { customerId: req.customer!.customerId },
    select: { id: true, platform: true, osVersion: true, appVersion: true, deviceModel: true, lastSeenAt: true, disabledAt: true },
    orderBy: { lastSeenAt: "desc" },
  });
  res.json(devices);
});

// DELETE /api/devices — called on LOGOUT, with the device's current token in the body.
// Without this, a logged-out phone keeps receiving the previous account's notifications
// until FCM eventually rotates the token, which can be weeks.
//
// The token goes in the body rather than the URL path deliberately: FCM tokens are ~160
// characters of base64-ish text, and URL-encoding them into a path is both fragile and
// leaks them into access logs.
router.delete("/", requireCustomerAuth, async (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== "string" || !token.trim()) {
    return res.status(400).json({ error: "token is required" });
  }

  // Scoped to the caller's own customerId so one customer can't unregister another's device
  // by guessing a token. deleteMany (not delete) because a no-match is a fine outcome here —
  // logging out twice shouldn't 404.
  const result = await prisma.deviceToken.deleteMany({
    where: { token: token.trim(), customerId: req.customer!.customerId },
  });

  res.json({ removed: result.count });
});

export default router;
