import { RequestHandler } from "express";
import { verifyCustomerToken } from "../services/customerAuth";

// Mirrors middleware/auth.ts's requireAuth exactly in structure — verifies the Authorization
// header and attaches the decoded payload, this time to req.customer instead of req.user.
// Deliberately a separate middleware, not requireAuth with an extra parameter, because the
// two check entirely different token shapes (verifyCustomerToken vs verifyToken) — see
// services/customerAuth.ts's CustomerTokenPayload for why they're distinct types.
export const requireCustomerAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice("Bearer ".length);
  try {
    req.customer = verifyCustomerToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};
