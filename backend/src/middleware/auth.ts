import { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { verifyToken } from "../services/auth";

// Verifies the Authorization: Bearer <token> header and attaches the decoded payload to
// req.user. Any route using this runs AFTER this middleware in the chain (see index.ts /
// individual route files), so by the time a handler runs, req.user is guaranteed to be set —
// that's what makes it safe for requireRole (below) to assume req.user exists.
export const requireAuth: RequestHandler = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice("Bearer ".length);
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    // Covers both an invalid signature (tampered/wrong-secret token) and an expired one —
    // jsonwebtoken throws for both, and the client's correct response is the same either way:
    // discard the token and log in again.
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Factory, not a single middleware — call it with the roles allowed for a given route,
// e.g. requireRole("ADMIN") or requireRole("STAFF", "ADMIN"). Must run after requireAuth.
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user) {
      // Defensive check — should be unreachable if requireAuth always runs first, but
      // failing closed (deny) instead of assuming is the safer default for auth code.
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions for this action" });
    }
    next();
  };
}
