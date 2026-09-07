import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";

// A Stack nested inside the Book tab so picking a service pushes forward (slots -> confirm)
// while the tab bar stays visible — matches the plan's "Services list -> Date/slot picker ->
// Confirm" sequence as three distinct screens rather than one growing form.
export default function BookLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: t("book.services.title") }} />
      <Stack.Screen name="slots" options={{ title: t("book.slots.title") }} />
      <Stack.Screen name="confirm" options={{ title: t("book.confirm.title") }} />
    </Stack>
  );
}
