import type { TFunction } from "i18next";
import { z } from "zod";

export function buildProfileSchema(t: TFunction) {
  return z.object({
    name: z.string().trim().min(1, t("auth.validation.nameRequired")),
    phone: z.string().trim().optional(),
  });
}
export type ProfileForm = z.infer<ReturnType<typeof buildProfileSchema>>;

export function buildChangePasswordSchema(t: TFunction) {
  return z
    .object({
      currentPassword: z.string().min(1, t("auth.validation.passwordTooShort")),
      newPassword: z.string().min(8, t("auth.validation.passwordTooShort")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("auth.validation.passwordMismatch"),
      path: ["confirmPassword"],
    });
}
export type ChangePasswordForm = z.infer<ReturnType<typeof buildChangePasswordSchema>>;
