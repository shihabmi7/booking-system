import { zodResolver } from "@hookform/resolvers/zod";
import { Link as RouterLink } from "expo-router";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Text, useTheme } from "react-native-paper";

import { UnverifiedLoginError } from "@/api/customerAuth";
import { ApiError } from "@/api/client";
import { useCustomerAuth } from "@/auth/CustomerAuthContext";
import { buildLoginSchema, type LoginForm } from "@/auth/validation";
import { AuthScreenLayout } from "@/components/AuthScreenLayout";
import { FormTextField } from "@/components/FormTextField";
import { PrimaryButton } from "@/components/PrimaryButton";

// (auth)/login — public, fully separate from any staff login (there is none in this app — see
// mobile-app-plan.md: customers only). Mirrors frontend/src/pages/customer/CustomerLoginPage.tsx,
// including the distinct "unverified" error state that offers a link straight to Verify rather
// than a plain "login failed."
export default function LoginScreen() {
  const { t } = useTranslation();
  const { login } = useCustomerAuth();
  const theme = useTheme();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);

  const schema = useMemo(() => buildLoginSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  // useWatch (not the form's own watch()) so the value is compiler-memoizable — watch() returns a
  // fresh subscription function on every render, which React Compiler can't safely memoize.
  const email = useWatch({ control, name: "email" });

  async function onSubmit(values: LoginForm) {
    setSubmitError(null);
    setUnverified(false);
    try {
      await login(values.email, values.password);
      // No further navigation call: app/index.tsx re-evaluates auth status on every render and
      // redirects to the signed-in home the moment CustomerAuthContext's status flips.
    } catch (err) {
      if (err instanceof UnverifiedLoginError) {
        setUnverified(true);
        setSubmitError(err.message);
      } else {
        setSubmitError(err instanceof ApiError ? err.message : t("errors.network"));
      }
    }
  }

  return (
    <AuthScreenLayout
      icon="account"
      title={t("auth.login.title")}
      footer={
        <>
          <Text variant="bodyMedium" style={{ textAlign: "center" }}>
            <RouterLink href={{ pathname: "/(auth)/forgot-password", params: { email } }}>
              {t("auth.login.forgotPassword")}
            </RouterLink>
          </Text>
          <Text variant="bodyMedium" style={{ textAlign: "center" }}>
            {t("auth.login.noAccount")}{" "}
            <RouterLink href="/(auth)/register">{t("auth.login.createAccount")}</RouterLink>
          </Text>
        </>
      }
    >
      <FormTextField
        control={control}
        name="email"
        label={t("auth.login.email")}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoFocus
      />
      <FormTextField
        control={control}
        name="password"
        label={t("auth.login.password")}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />

      {submitError && (
        <Text
          variant="bodyMedium"
          accessibilityRole="alert"
          style={{ color: unverified ? theme.colors.onSurface : theme.colors.error }}
        >
          {submitError}
          {unverified && (
            <>
              {" "}
              <RouterLink href={{ pathname: "/(auth)/verify", params: { email } }}>
                {t("auth.login.verifyNow")}
              </RouterLink>
            </>
          )}
        </Text>
      )}

      <PrimaryButton loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        {isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
      </PrimaryButton>
    </AuthScreenLayout>
  );
}
