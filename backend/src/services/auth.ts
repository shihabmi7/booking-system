import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";

// Shape encoded inside the JWT payload. Kept minimal on purpose — enough to authorize
// requests (who, what role, which business) without needing a database lookup on every
// request. Anything else about the user (name, etc) would need its own DB query if needed.
export type AuthTokenPayload = {
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

export function signToken(payload: AuthTokenPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, secret, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });
}

export function verifyToken(token: string): AuthTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  // jwt.verify throws if the signature is invalid or the token is expired — callers
  // (the requireAuth middleware) are expected to catch that and respond with 401.
  return jwt.verify(token, secret) as AuthTokenPayload;
}
