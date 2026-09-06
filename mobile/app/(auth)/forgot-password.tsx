import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink, router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Text } from "react-native-paper";

import { forgotPassword } from "@/api/customerAuth";
import { ApiError } from "@/api/client";
import { buildForgotPasswordSchema, type ForgotPasswordForm } from "@/auth/validation";
import { AuthScreenLayout } from "@/components/AuthScreenLayout";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FormTextField } from "@/components/FormTextField";
import { PrimaryButton } from "@/components/PrimaryButton";

// (auth)/forgot-password — public. Always shows the same generic message regardless of whether
// the email is registered (see backend/src/routes/customer.ts's anti-enumeration note) — this
// screen can't tell the customer "check your email" vs "no account found" even if it wanted to,
// because the backend deliberately doesn't say which happened.
export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ email?: string }>();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const schema = useMemo(() => buildForgotPasswordSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.email ?? "" },
  });
  // useWatch (not the form's own watch()) so "I already have a code" enables as the customer
  // types, and so the value stays compiler-memoizable — watch() returns a fresh subscription
  // function on every render, which React Compiler can't safely memoize.
  const email = useWatch({ control, name: "email" });

  async function onSubmit(values: ForgotPasswordForm) {
    setSubmitError(null);
    setMessage(null);
    try {
      const result = await forgotPassword(values);
      setMessage(result.message);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("errors.network"));
    }
  }

  return (
    <AuthScreenLayout
      icon="lock-reset"
      title={t("auth.forgotPassword.title")}
      subtitle={t("auth.forgotPassword.subtitle")}
      footer={
        <Text variant="bodyMedium" style={{ textAlign: "center" }}>
          <RouterLink href="/(auth)/login">{t("auth.forgotPassword.backToLogin")}</RouterLink>
        </Text>
      }
    >
      <FormTextField
        control={control}
        name="email"
        label={t("auth.forgotPassword.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus
      />

      <ErrorBanner message={submitError} />
      {message && <Text variant="bodyMedium">{message}</Text>}

      <PrimaryButton loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        {isSubmitting ? t("auth.forgotPassword.submitting") : t("auth.forgotPassword.submit")}
      </PrimaryButton>
      <PrimaryButton
        mode="text"
        loading={false}
        disabled={!email}
        onPress={() => router.push({ pathname: "/(auth)/reset-password", params: { email } })}
      >
        {t("auth.forgotPassword.haveCode")}
      </PrimaryButton>
    </AuthScreenLayout>
  );
}
