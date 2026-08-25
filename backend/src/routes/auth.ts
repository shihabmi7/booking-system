import { Router } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../db/prisma";
import { hashPassword, signToken, verifyPassword } from "../services/auth";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();

// POST /api/auth/login — the only public auth endpoint. No self-registration: staff/admin
// accounts are created by an existing admin (POST /api/auth/users below) or the seed script
// for the very first admin. This isn't a consumer app with public signup.
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Deliberately the same error for "no such user" and "wrong password" — a different
  // message for each would let an attacker enumerate which emails have accounts.
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ userId: user.id, role: user.role, businessId: user.businessId });
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, businessId: user.businessId },
  });
});

// GET /api/auth/me — lets the frontend check "who am I" / whether the stored token is
// still valid, without hardcoding user details into localStorage alongside the token.
router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });
  res.json({ id: user.id, email: user.email, role: user.role, businessId: user.businessId });
});

// POST /api/auth/users — admin-only. Creates a new staff or admin account for the SAME
// business as the admin making the request (never a different business — see businessId).
router.post("/users", requireAuth, requireRole(UserRole.ADMIN), async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: "email, password, and role are required" });
  }
  if (role !== "STAFF" && role !== "ADMIN") {
    return res.status(400).json({ error: "role must be STAFF or ADMIN" });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "A user with this email already exists" });

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role, businessId: req.user!.businessId },
  });

  res.status(201).json({ id: user.id, email: user.email, role: user.role, businessId: user.businessId });
});

// GET /api/auth/users — admin-only. Lists accounts for the admin's own business only.
router.get("/users", requireAuth, requireRole(UserRole.ADMIN), async (req, res) => {
  const users = await prisma.user.findMany({
    where: { businessId: req.user!.businessId },
    select: { id: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(users);
});

export default router;
