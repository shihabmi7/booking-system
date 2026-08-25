import jwt from "jsonwebtoken";

// Customer's own token shape — deliberately a SEPARATE type from services/auth.ts's
// AuthTokenPayload (staff), not a union or a shared "kind: string" field on one type. Keeping
// them as two distinct types means TypeScript itself won't let code accidentally read
// req.user.role off a customer token or vice versa — the type system enforces the same
// staff/customer separation the `kind` check enforces at runtime.
export type CustomerTokenPayload = {
  kind: "customer";
  customerId: string;
  email: string;
};

// Same JWT_SECRET as staff tokens (services/auth.ts) — that's fine, because `kind` is what
// actually enforces the boundary between the two, not having separate secrets. Reusing the
// secret just means one env var to manage instead of two.
export function signCustomerToken(payload: Omit<CustomerTokenPayload, "kind">): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const expiresIn = (process.env.JWT_EXPIRES_IN || "8h") as jwt.SignOptions["expiresIn"];
  return jwt.sign({ ...payload, kind: "customer" }, secret, { expiresIn });
}

export function verifyCustomerToken(token: string): CustomerTokenPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const decoded = jwt.verify(token, secret) as CustomerTokenPayload;
  if (decoded.kind !== "customer") {
    throw new Error("Not a customer token");
  }
  return decoded;
}
