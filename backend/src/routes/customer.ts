import { Router } from "express";
import { OtpPurpose } from "@prisma/client";
import { prisma } from "../db/prisma";
import { hashPassword, verifyPassword } from "../services/auth";
import { signCustomerToken } from "../services/customerAuth";
import { createOtp, verifyOtp } from "../services/otp";
import { requireCustomerAuth } from "../middleware/customerAuth";
import { uploadProfilePicture } from "../services/upload";
import multer from "multer";

const router = Router();

// Shape sent back to the frontend after login/verify/me — deliberately excludes passwordHash.
function toPublicCustomer(customer: {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  profilePictureUrl: string | null;
}) {
  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    profilePictureUrl: customer.profilePictureUrl,
  };
}

// POST /api/customer/register — public. Creates an UNVERIFIED account and sends an OTP;
// the customer can't log in (see /login below) or book anything until they verify it.
router.post("/register", async (req, res) => {
  const { email, password, name, phone } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "email, password, and name are required" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ error: "password must be at least 8 characters" });
  }

  const existing = await prisma.customer.findUnique({ where: { email } });
  if (existing) {
    // Unlike login/forgot-password, registration IS the one place it's worth confirming an
    // email is taken — silently "succeeding" would just leave the customer unable to log in
    // later with no explanation. The tradeoff (this endpoint can be used to enumerate
    // registered emails) is accepted for the UX win, same as most consumer signup forms.
    return res.status(409).json({ error: "An account with this email already exists." });
  }

  const passwordHash = await hashPassword(password);
  const customer = await prisma.customer.create({
    data: { email, passwordHash, name, phone: phone || undefined },
  });

  const otpResult = await createOtp(customer.id, OtpPurpose.EMAIL_VERIFY);
  if (!otpResult.ok) {
    return res.status(429).json({ error: otpResult.error });
  }

  res.status(201).json({
    email: customer.email,
    message: "Account created. Check your email for a 6-digit verification code.",
  });
});

// POST /api/customer/verify-otp — public. Marks the account verified and immediately logs
// the customer in (returns a token) so they don't have to verify, then separately log in.
router.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "email and code are required" });

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) return res.status(404).json({ error: "No account found for this email." });
  if (customer.emailVerifiedAt) {
    return res.status(409).json({ error: "This email is already verified. Try logging in." });
  }

  const result = await verifyOtp(customer.id, OtpPurpose.EMAIL_VERIFY, code);
  if (!result.ok) return res.status(400).json({ error: result.error });

  const verified = await prisma.customer.update({
    where: { id: customer.id },
    data: { emailVerifiedAt: new Date() },
  });

  const token = signCustomerToken({ customerId: verified.id, email: verified.email });
  res.json({ token, customer: toPublicCustomer(verified) });
});

// POST /api/customer/resend-otp — public. Same generic response whether or not the email
// belongs to a real (or already-verified) account — don't let this endpoint be used to probe
// which emails have unverified registrations in progress.
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  const genericMessage = "If an unverified account exists for this email, a new code has been sent.";

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer || customer.emailVerifiedAt) {
    return res.json({ message: genericMessage });
  }

  const result = await createOtp(customer.id, OtpPurpose.EMAIL_VERIFY);
  if (!result.ok) return res.status(429).json({ error: result.error });

  res.json({ message: genericMessage });
});

// POST /api/customer/login — public. Requires a verified email, distinct from a wrong
// password so the frontend can offer "resend code" instead of just "try again."
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer || !(await verifyPassword(password, customer.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  if (!customer.emailVerifiedAt) {
    return res.status(403).json({ error: "Please verify your email before logging in.", unverified: true });
  }

  const token = signCustomerToken({ customerId: customer.id, email: customer.email });
  res.json({ token, customer: toPublicCustomer(customer) });
});

// POST /api/customer/forgot-password — public. Same "don't reveal whether the email exists"
// principle as staff login and resend-otp above.
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "email is required" });

  const genericMessage = "If an account exists for this email, a password reset code has been sent.";

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) return res.json({ message: genericMessage });

  const result = await createOtp(customer.id, OtpPurpose.PASSWORD_RESET);
  if (!result.ok) return res.status(429).json({ error: result.error });

  res.json({ message: genericMessage });
});

// POST /api/customer/reset-password — public (that's the point — the customer is locked out).
// Proves identity via the OTP just emailed, not a password (which is exactly what's forgotten).
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "email, code, and newPassword are required" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "newPassword must be at least 8 characters" });
  }

  const customer = await prisma.customer.findUnique({ where: { email } });
  if (!customer) return res.status(400).json({ error: "Invalid code." }); // same message as a wrong code — no enumeration

  const result = await verifyOtp(customer.id, OtpPurpose.PASSWORD_RESET, code);
  if (!result.ok) return res.status(400).json({ error: result.error });

  const passwordHash = await hashPassword(newPassword);
  await prisma.customer.update({ where: { id: customer.id }, data: { passwordHash } });

  res.json({ message: "Password reset. You can now log in with your new password." });
});

// POST /api/customer/change-password — requires being logged in already, and re-proving the
// CURRENT password (not just a valid token) — standard practice so a hijacked-but-still-open
// session can't be used to lock the real owner out by silently changing the password.
router.post("/change-password", requireCustomerAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return res.status(400).json({ error: "newPassword must be at least 8 characters" });
  }

  const customer = await prisma.customer.findUnique({ where: { id: req.customer!.customerId } });
  if (!customer || !(await verifyPassword(currentPassword, customer.passwordHash))) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.customer.update({ where: { id: customer.id }, data: { passwordHash } });

  res.json({ message: "Password changed." });
});

// GET /api/customer/me — lets the frontend verify a stored token is still valid and fetch
// the current profile, same role GET /api/auth/me plays for staff.
router.get("/me", requireCustomerAuth, async (req, res) => {
  const customer = await prisma.customer.findUnique({ where: { id: req.customer!.customerId } });
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.json(toPublicCustomer(customer));
});

// PATCH /api/customer/me — name and phone only. Email is intentionally NOT editable here —
// it's the fixed identifier the account is looked up by everywhere (login, OTP delivery).
// Changing it would need its own re-verification flow, deliberately out of scope for now.
router.patch("/me", requireCustomerAuth, async (req, res) => {
  const { name, phone } = req.body;
  if (name !== undefined && (typeof name !== "string" || !name.trim())) {
    return res.status(400).json({ error: "name must be a non-empty string" });
  }

  const updated = await prisma.customer.update({
    where: { id: req.customer!.customerId },
    data: { name: name?.trim(), phone },
  });

  res.json(toPublicCustomer(updated));
});

// POST /api/customer/me/picture — multipart upload, field name "picture". Separate endpoint
// from PATCH /me rather than accepting a picture field there too, because a file upload needs
// a different Content-Type (multipart/form-data, not JSON) and different middleware (multer)
// — mixing them would mean every PATCH /me request goes through multer's parsing for nothing.
router.post("/me/picture", requireCustomerAuth, (req, res) => {
  uploadProfilePicture(req, res, async (err) => {
    if (err instanceof multer.MulterError || err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded (expected field name 'picture')" });
    }

    const profilePictureUrl = `/uploads/profile-pictures/${req.file.filename}`;
    const updated = await prisma.customer.update({
      where: { id: req.customer!.customerId },
      data: { profilePictureUrl },
    });

    res.json(toPublicCustomer(updated));
  });
});

// GET /api/customer/bookings — the logged-in customer's own booking history, most recent
// first. Scoped by customerId from the token, never a query param — a customer can only ever
// see their own bookings, the same ownership principle staff endpoints enforce per-business.
router.get("/bookings", requireCustomerAuth, async (req, res) => {
  const bookings = await prisma.booking.findMany({
    where: { customerId: req.customer!.customerId },
    include: {
      service: { select: { name: true, durationMins: true, price: true } },
      resource: { select: { name: true, business: { select: { name: true } } } },
    },
    orderBy: { startTime: "desc" },
  });
  res.json(bookings);
});

export default router;
