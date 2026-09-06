import { zodResolver } from "@hookform/resolvers/zod";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { resetPassword } from "@/api/customerAuth";
import { ApiError } from "@/api/client";
import { buildResetPasswordSchema, type ResetPasswordForm } from "@/auth/validation";
import { AuthScreenLayout } from "@/components/AuthScreenLayout";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FormTextField } from "@/components/FormTextField";
import { PrimaryButton } from "@/components/PrimaryButton";

// (auth)/reset-password — public (that's the point — the customer is locked out). Proves
// identity via the OTP just emailed (via forgot-password), not a password.
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();

  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = useMemo(() => buildResetPasswordSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.email ?? "", code: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordForm) {
    setSubmitError(null);
    try {
      await resetPassword(values);
      router.replace({ pathname: "/(auth)/login" });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("errors.network"));
    }
  }

  return (
    <AuthScreenLayout icon="lock-reset" title={t("auth.resetPassword.title")}>
      <FormTextField
        control={control}
        name="email"
        label={t("auth.resetPassword.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus={!params.email}
      />
      <FormTextField
        control={control}
        name="code"
        label={t("auth.resetPassword.code")}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus={!!params.email}
      />
      <FormTextField
        control={control}
        name="newPassword"
        label={t("auth.resetPassword.newPassword")}
        helperText={t("auth.resetPassword.newPasswordHelper")}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormTextField
        control={control}
        name="confirmPassword"
        label={t("auth.resetPassword.confirmPassword")}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <ErrorBanner message={submitError} />

      <PrimaryButton loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        {isSubmitting ? t("auth.resetPassword.submitting") : t("auth.resetPassword.submit")}
      </PrimaryButton>
    </AuthScreenLayout>
  );
}
