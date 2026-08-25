import bcrypt from "bcryptjs";
import { OtpPurpose } from "@prisma/client";
import { prisma } from "../db/prisma";

const SALT_ROUNDS = 10;
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

type Result = { ok: true } | { ok: false; error: string };

// Generates a uniformly random 6-digit code, including ones with leading zeros (e.g. "003417")
// — Math.floor(100000 + Math.random() * 900000) would exclude those and quietly shrink the
// space from 1,000,000 possibilities to 900,000. padStart is what keeps every code equally likely.
function generateCode(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
}

// Creates and "sends" (console.log — see customer-accounts-plan.md; a real provider is
// Phase 6's SES work) a new OTP for a customer. Enforces a resend cooldown so a customer
// (or a script) can't spam requests — each call checks the most recently created code for
// this purpose, not a separate rate-limit table.
export async function createOtp(customerId: string, purpose: OtpPurpose): Promise<Result> {
  const mostRecent = await prisma.otpCode.findFirst({
    where: { customerId, purpose },
    orderBy: { createdAt: "desc" },
  });

  if (mostRecent) {
    const elapsedMs = Date.now() - mostRecent.createdAt.getTime();
    const cooldownMs = RESEND_COOLDOWN_SECONDS * 1000;
    if (elapsedMs < cooldownMs) {
      const waitSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
      return { ok: false, error: `Please wait ${waitSeconds}s before requesting another code.` };
    }
  }

  const code = generateCode();
  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  await prisma.otpCode.create({ data: { customerId, purpose, codeHash, expiresAt } });

  // Stand-in for actually emailing the customer — logged loudly so it's easy to spot in the
  // dev server's console while testing the flow end to end.
  console.log(`[OTP] ${purpose} code for customer ${customerId}: ${code} (expires in ${OTP_TTL_MINUTES}m)`);

  return { ok: true };
}

// Checks a submitted code against the customer's most recent, still-valid (unconsumed) code
// for this purpose. Increments `attempts` on a wrong guess rather than deleting/regenerating —
// so MAX_ATTEMPTS actually caps how many guesses one issued code allows.
export async function verifyOtp(customerId: string, purpose: OtpPurpose, submittedCode: string): Promise<Result> {
  const otp = await prisma.otpCode.findFirst({
    where: { customerId, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!otp) return { ok: false, error: "No active code found. Please request a new one." };
  if (otp.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: "This code has expired. Please request a new one." };
  }
  if (otp.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many incorrect attempts. Please request a new code." };
  }

  const matches = await bcrypt.compare(submittedCode, otp.codeHash);
  if (!matches) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Incorrect code." };
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}
