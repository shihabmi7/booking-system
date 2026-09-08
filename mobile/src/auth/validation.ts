import { z } from "zod";
import type { TFunction } from "i18next";

// Schemas are built from a `t` rather than declared once at module scope so validation messages
// switch with the active language — zod has no i18n hook of its own, but a schema is cheap enough
// to rebuild on every render (screens do this via `useMemo(() => build...(t), [t])`).

const email = (t: TFunction) => z.string().min(1, t("auth.validation.emailInvalid")).email(t("auth.validation.emailInvalid"));
const password = (t: TFunction) => z.string().min(8, t("auth.validation.passwordTooShort"));

export function buildRegisterSchema(t: TFunction) {
  return z
    .object({
      name: z.string().trim().min(1, t("auth.validation.nameRequired")),
      email: email(t),
      phone: z.string().trim().optional(),
      password: password(t),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.validation.passwordMismatch"),
      path: ["confirmPassword"],
    });
}
export type RegisterForm = z.infer<ReturnType<typeof buildRegisterSchema>>;

export function buildVerifyOtpSchema(t: TFunction) {
  return z.object({
    email: email(t),
    code: z.string().trim().length(6, t("auth.validation.codeRequired")),
  });
}
export type VerifyOtpForm = z.infer<ReturnType<typeof buildVerifyOtpSchema>>;

export function buildLoginSchema(t: TFunction) {
  return z.object({
    email: email(t),
    password: z.string().min(1, t("auth.validation.passwordTooShort")),
  });
}
export type LoginForm = z.infer<ReturnType<typeof buildLoginSchema>>;

export function buildForgotPasswordSchema(t: TFunction) {
  return z.object({ email: email(t) });
}
export type ForgotPasswordForm = z.infer<ReturnType<typeof buildForgotPasswordSchema>>;

export function buildResetPasswordSchema(t: TFunction) {
  return z
    .object({
      email: email(t),
      code: z.string().trim().length(6, t("auth.validation.codeRequired")),
      newPassword: password(t),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("auth.validation.passwordMismatch"),
      path: ["confirmPassword"],
    });
}
export type ResetPasswordForm = z.infer<ReturnType<typeof buildResetPasswordSchema>>;
