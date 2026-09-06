import { Redirect } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { ActivityIndicator, Button, Text } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCustomerAuth } from "@/auth/CustomerAuthContext";

// Phase 2's auth entry point. A placeholder home for a signed-in customer — the real Home tab
// (and the Book/My Bookings/Profile tabs alongside it) is Phase 3+'s work; this screen exists so
// register → verify → login has somewhere real to land and prove the session actually persists,
// rather than the flow ending at an unstyled blank screen.
export default function HomeScreen() {
  const { t } = useTranslation();
  const { status, customer, logout } = useCustomerAuth();

  // Restoring the session from SecureStore/AsyncStorage is async — this is the one moment that's
  // true, since app/_layout.tsx only waits on fonts and i18n before rendering this screen at all.
  if (status === "loading") {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (status === "signedOut") return <Redirect href="/(auth)/login" />;

  return (
    <SafeAreaView style={styles.center}>
      <Text variant="headlineSmall">{t("auth.home.title")}</Text>
      <Text variant="bodyMedium">{t("auth.home.signedInAs", { email: customer?.email })}</Text>
      <Button mode="outlined" onPress={() => void logout()} style={styles.logoutButton}>
        {t("auth.home.logOut")}
      </Button>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  logoutButton: { marginTop: 8 },
});
