import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";

// Shape encoded inside the JWT payload. Kept minimal on purpose — enough to authorize
// requests (who, what role, which business) without needing a database lookup on every
// request. Anything else about the user (name, etc) would need its own DB query if needed.
//
// `kind: "staff"` exists specifically so a customer token (see services/customerAuth.ts,
// which has its own `kind: "customer"`) can never satisfy requireAuth even if some route
// forgets a role check — the middleware checks `kind` explicitly, not just presence of a
// valid signature. Staff and customers are two separate identity systems that happen to
// share this JWT infrastructure, not one unified "logged in" concept.
export type AuthTokenPayload = {
  kind: "staff";
  userId: string;
  role: UserRole;
  businessId: string;
};

const SALT_ROUNDS = 10;

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

// Callers pass everything except `kind` — it's injected here so every staff token is
// guaranteed to carry it, instead of relying on every call site to remember to include it.
export function signToken(payload: Omit<AuthTokenPayload, "kind">): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  // @types/jsonwebtoken types expiresIn as `number | StringValue` — a template-literal type
  // restricted to specific formats like "8h"/"30m", not a plain `string`. Reading it from
  // process.env (always typed as `string`) doesn't satisfy that automatically, so this cast
  // tells TypeScript "trust me, JWT_EXPIRES_IN is one of the accepted formats" — it's still
  // checked at runtime by jsonwebtoken itself, which throws if the format is actually invalid.
  const expiresIn = (process.env.JWT_EXPIRES_IN || "8h") as jwt.SignOptions["expiresIn"];
  return jwt.sign({ ...payload, kind: "staff" }, secret, { expiresIn });
}

export function verifyToken(token: string): AuthTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  // jwt.verify throws if the signature is invalid or the token is expired — callers
  // (the requireAuth middleware) are expected to catch that and respond with 401.
  const decoded = jwt.verify(token, secret) as AuthTokenPayload;
  // Belt-and-suspenders: reject a structurally-valid, correctly-signed token that just
  // happens to be the WRONG kind (a customer token) — see the type's doc comment above.
  if (decoded.kind !== "staff") {
    throw new Error("Not a staff token");
  }
  return decoded;
}
