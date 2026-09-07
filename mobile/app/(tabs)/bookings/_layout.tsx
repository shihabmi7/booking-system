import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function BookingsLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: t("nav.bookings") }} />
    </Stack>
  );
}
