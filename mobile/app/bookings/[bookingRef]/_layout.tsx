import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

export default function BookingRefLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: t("bookingDetails.title") }} />
      <Stack.Screen name="reschedule" options={{ title: t("bookingDetails.reschedule.title") }} />
    </Stack>
  );
}
