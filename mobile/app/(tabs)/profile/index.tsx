import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Avatar, IconButton, Text, useTheme } from "react-native-paper";

import { ApiError } from "@/api/client";
import { resolveAssetUrl } from "@/api/config";
import { updateProfile, uploadProfilePicture } from "@/api/customerProfile";
import { useAuthedFetch } from "@/auth/useAuthedFetch";
import { useCustomerAuth } from "@/auth/CustomerAuthContext";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FormTextField } from "@/components/FormTextField";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { PrimaryButton } from "@/components/PrimaryButton";
import { buildProfileSchema, type ProfileForm } from "@/profile/validation";

// Phase 5: view/edit name+phone, picture upload, language switcher. Email is shown but not
// editable (see backend's PATCH /me comment). "Log out" lives here rather than on Home,
// matching the web app's separation of account management from the landing page.
export default function ProfileScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { customer, updateCustomer, logout } = useCustomerAuth();
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const schema = useMemo(() => buildProfileSchema(t), [t]);
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: customer?.name ?? "", phone: customer?.phone ?? "" },
  });

  const pictureMutation = useMutation({
    mutationFn: (image: { uri: string; fileName: string; mimeType: string }) =>
      uploadProfilePicture(authedFetch, image),
    onSuccess: async (updated) => {
      await updateCustomer(updated);
      setSuccess(t("profile.pictureUpdated"));
      setError(null);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("errors.network")),
  });

  async function pickPicture() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t("profile.pictureLibraryPermissionDenied"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    pictureMutation.mutate({
      uri: asset.uri,
      fileName: asset.fileName ?? "profile-picture.jpg",
      mimeType: asset.mimeType ?? "image/jpeg",
    });
  }

  async function onSubmit(values: ProfileForm) {
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateProfile(authedFetch, { name: values.name, phone: values.phone || null });
      await updateCustomer(updated);
      setSuccess(t("profile.updated"));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errors.network"));
    }
  }

  async function handleLogout() {
    // Booking/profile queries are keyed off "who is logged in" implicitly — without clearing
    // the cache, the NEXT customer to sign in on this device would flash the previous
    // customer's bookings/profile for a moment before their own fetch lands.
    await logout();
    queryClient.clear();
  }

  if (!customer) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          {customer.profilePictureUrl ? (
            <Avatar.Image size={88} source={{ uri: resolveAssetUrl(customer.profilePictureUrl) }} />
          ) : (
            <Avatar.Text size={88} label={customer.name.charAt(0).toUpperCase()} />
          )}
          <IconButton
            icon="camera"
            mode="contained"
            // 28, not the visually-tighter 18 — react-native-paper's IconButton sizes its
            // touchable container as `size + 16`, so this is the smallest value that still
            // clears the 44pt/48dp minimum touch target both platforms' accessibility
            // guidelines call for (18 alone would render a ~34pt target).
            size={28}
            style={styles.avatarEditButton}
            loading={pictureMutation.isPending}
            onPress={pickPicture}
            accessibilityLabel={t("profile.changePicture")}
          />
        </View>
        <Text variant="titleLarge">{customer.name}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>{customer.email}</Text>
      </View>

      <View style={styles.form}>
        <FormTextField control={control} name="name" label={t("profile.name")} autoComplete="name" />
        <FormTextField control={control} name="phone" label={t("profile.phone")} keyboardType="phone-pad" />

        <ErrorBanner message={error} />
        {success && <Text style={{ color: theme.colors.primary }}>{success}</Text>}

        <PrimaryButton loading={isSubmitting} onPress={handleSubmit(onSubmit)}>
          {isSubmitting ? t("common.loading") : t("common.save")}
        </PrimaryButton>
      </View>

      <LanguageSwitcher />

      <View style={styles.footer}>
        <PrimaryButton mode="text" loading={false} onPress={() => router.push("/(tabs)/profile/security")}>
          {t("profile.security.title")}
        </PrimaryButton>
        <PrimaryButton mode="text" loading={false} onPress={handleLogout}>
          {t("profile.logOut")}
        </PrimaryButton>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 24 },
  header: { alignItems: "center", gap: 8 },
  avatarWrap: { position: "relative" },
  avatarEditButton: { position: "absolute", bottom: -4, right: -4 },
  form: { gap: 4 },
  footer: { gap: 4, marginTop: 8 },
});
