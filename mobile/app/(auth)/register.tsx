import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink, router } from "expo-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Text } from "react-native-paper";

import { register as registerCustomer } from "@/api/customerAuth";
import { ApiError } from "@/api/client";
import { AuthScreenLayout } from "@/components/AuthScreenLayout";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FormTextField } from "@/components/FormTextField";
import { buildRegisterSchema, type RegisterForm } from "@/auth/validation";
import { PrimaryButton } from "@/components/PrimaryButton";

// (auth)/register — public. Creates an unverified account and hands off to (auth)/verify to
// enter the OTP, mirroring the web app's /customer/register → /customer/verify handoff
// (frontend/src/pages/customer/CustomerRegisterPage.tsx).
export default function RegisterScreen() {
  const { t } = useTranslation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = useMemo(() => buildRegisterSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: RegisterForm) {
    setSubmitError(null);
    try {
      await registerCustomer({
        name: values.name,
        email: values.email,
        phone: values.phone || undefined,
        password: values.password,
      });
      router.push({ pathname: "/(auth)/verify", params: { email: values.email } });
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("errors.network"));
    }
  }

  return (
    <AuthScreenLayout
      icon="account-plus"
      title={t("auth.register.title")}
      subtitle={t("auth.register.subtitle")}
      footer={
        <Text variant="bodyMedium" style={{ textAlign: "center" }}>
          {t("auth.register.haveAccount")}{" "}
          <RouterLink href="/(auth)/login">{t("auth.register.logIn")}</RouterLink>
        </Text>
      }
    >
      <FormTextField
        control={control}
        name="name"
        label={t("auth.register.name")}
        autoFocus
        autoComplete="name"
        textContentType="name"
      />
      <FormTextField
        control={control}
        name="email"
        label={t("auth.register.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <FormTextField control={control} name="phone" label={t("auth.register.phone")} keyboardType="phone-pad" />
      <FormTextField
        control={control}
        name="password"
        label={t("auth.register.password")}
        helperText={t("auth.register.passwordHelper")}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormTextField
        control={control}
        name="confirmPassword"
        label={t("auth.register.confirmPassword")}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <ErrorBanner message={submitError} />

      <PrimaryButton loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        {isSubmitting ? t("auth.register.submitting") : t("auth.register.submit")}
      </PrimaryButton>
    </AuthScreenLayout>
  );
}
