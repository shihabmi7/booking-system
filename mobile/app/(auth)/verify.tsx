import { zodResolver } from "@hookform/resolvers/zod";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Text } from "react-native-paper";

import { resendOtp, verifyOtp } from "@/api/customerAuth";
import { ApiError } from "@/api/client";
import { useCustomerAuth } from "@/auth/CustomerAuthContext";
import { buildVerifyOtpSchema, type VerifyOtpForm } from "@/auth/validation";
import { AuthScreenLayout } from "@/components/AuthScreenLayout";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FormTextField } from "@/components/FormTextField";
import { PrimaryButton } from "@/components/PrimaryButton";

// (auth)/verify — public. Enter the 6-digit code from Register or Login's "verify now" link. On
// success the backend auto-logs the customer in (returns a token), so this screen finishes by
// writing that session into CustomerAuthContext — the (auth) layout's own guard then redirects
// away from the auth stack, so there's no separate "now go log in" step or manual navigation here.
export default function VerifyScreen() {
  const { t } = useTranslation();
  const { setSession } = useCustomerAuth();
  const params = useLocalSearchParams<{ email?: string }>();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const schema = useMemo(() => buildVerifyOtpSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<VerifyOtpForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: params.email ?? "", code: "" },
  });
  // useWatch (not the form's own watch()) so the resend button's disabled state reacts as the
  // customer types an email in, and so the value stays compiler-memoizable — watch() returns a
  // fresh subscription function on every render, which React Compiler can't safely memoize.
  const email = useWatch({ control, name: "email" });

  async function onSubmit(values: VerifyOtpForm) {
    setSubmitError(null);
    setInfo(null);
    try {
      const session = await verifyOtp(values);
      // A real "you're in" moment — the one step in the whole auth flow that ends with the
      // customer suddenly signed in rather than just moving to another form, so it's one of
      // the two haptic touchpoints the plan calls out (the other being a confirmed booking).
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await setSession(session.token, session.customer);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("errors.network"));
    }
  }

  async function handleResend() {
    if (!email) return;
    setSubmitError(null);
    setInfo(null);
    setResending(true);
    try {
      const result = await resendOtp({ email });
      setInfo(result.message);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("errors.network"));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthScreenLayout icon="email-check" title={t("auth.verify.title")} subtitle={t("auth.verify.subtitle")}>
      <FormTextField
        control={control}
        name="email"
        label={t("auth.verify.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus={!params.email}
      />
      <FormTextField
        control={control}
        name="code"
        label={t("auth.verify.code")}
        keyboardType="number-pad"
        maxLength={6}
        autoFocus={!!params.email}
      />

      <ErrorBanner message={submitError} />
      {info && <Text variant="bodyMedium">{info}</Text>}

      <PrimaryButton loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        {isSubmitting ? t("auth.verify.submitting") : t("auth.verify.submit")}
      </PrimaryButton>
      <PrimaryButton mode="text" loading={resending} disabled={!email} onPress={handleResend}>
        {resending ? t("auth.verify.resending") : t("auth.verify.resend")}
      </PrimaryButton>
    </AuthScreenLayout>
  );
}
