import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function ProfileLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: t("nav.profile") }} />
      <Stack.Screen name="security" options={{ title: t("profile.security.title") }} />
    </Stack>
  );
}
