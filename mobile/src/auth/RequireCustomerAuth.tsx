import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet } from "react-native";
import { ActivityIndicator } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCustomerAuth } from "./CustomerAuthContext";

/**
 * Mobile equivalent of the web app's RequireCustomerAuth (frontend/src/auth/
 * RequireCustomerAuth.tsx) — wrap any screen/layout that needs a logged-in customer. Unlike
 * the web version there's a third state to handle: restoring the session from SecureStore/
 * AsyncStorage is async, so "not signed in yet" and "definitely signed out" aren't the same
 * moment here — rendering the redirect during "loading" would bounce someone who is actually
 * still signed in straight to the login screen for a flash before landing back on `/`.
 *
 * No "from" location param the way the web version carries one: Expo Router's own history
 * (`router.back()`) already gets someone back to what they were doing after Login, since nothing
 * here does a `replace` navigation away from the screen that redirected — see app/(tabs)/
 * _layout.tsx and app/bookings/[bookingRef].tsx for the two places this wraps.
 */
export function RequireCustomerAuth({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { status } = useCustomerAuth();

  if (status === "loading") {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (status === "signedOut") return <Redirect href="/(auth)/login" />;

  return <>{children}</>;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: "center", justifyContent: "center" } });
