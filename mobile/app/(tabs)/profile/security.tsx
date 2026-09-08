import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { ApiError } from "@/api/client";
import { changePassword } from "@/api/customerProfile";
import { useAuthedFetch } from "@/auth/useAuthedFetch";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FormTextField } from "@/components/FormTextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { buildChangePasswordSchema, type ChangePasswordForm } from "@/profile/validation";

// Phase 5: change password. Requires re-entering the CURRENT password — the backend enforces
// this itself (see backend/src/routes/customer.ts's change-password comment), so a hijacked-
// but-still-open session can't lock the real owner out by silently changing it.
export default function SecurityScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const authedFetch = useAuthedFetch();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const schema = useMemo(() => buildChangePasswordSchema(t), [t]);
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ChangePasswordForm) {
    setError(null);
    setSuccess(null);
    try {
      const result = await changePassword(authedFetch, {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setSuccess(result.message);
      reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.network"));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <FormTextField
        control={control}
        name="currentPassword"
        label={t("profile.security.currentPassword")}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        autoFocus
      />
      <FormTextField
        control={control}
        name="newPassword"
        label={t("profile.security.newPassword")}
        helperText={t("auth.register.passwordHelper")}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormTextField
        control={control}
        name="confirmPassword"
        label={t("profile.security.confirmPassword")}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <ErrorBanner message={error} />
      {success && <Text style={{ color: theme.colors.primary }}>{success}</Text>}

      <PrimaryButton loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
        {isSubmitting ? t("profile.security.submitting") : t("profile.security.submit")}
      </PrimaryButton>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { padding: 24, gap: 4 } });
