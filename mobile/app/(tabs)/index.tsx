import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Button, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { useCustomerAuth } from "@/auth/CustomerAuthContext";

// Home tab — mirrors the web app's HomePage.tsx: a hero plus the two things a customer actually
// came here for, not the account-management/logout controls (those live in Profile, Phase 5).
export default function HomeScreen() {
  const { t } = useTranslation();
  const { customer } = useCustomerAuth();
  const theme = useTheme();

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.hero}>
        <Text variant="headlineMedium">{t("home.title")}</Text>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {t("home.subtitle")}
        </Text>
        {customer && (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {t("auth.home.signedInAs", { email: customer.email })}
          </Text>
        )}
      </Animated.View>

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon={({ color, size }) => <MaterialCommunityIcons name="calendar-plus" color={color} size={size} />}
          onPress={() => router.push("/(tabs)/book")}
        >
          {t("home.bookCta")}
        </Button>
        <Button
          mode="outlined"
          icon={({ color, size }) => <MaterialCommunityIcons name="calendar-check" color={color} size={size} />}
          onPress={() => router.push("/(tabs)/bookings")}
        >
          {t("home.bookingsCta")}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 32, justifyContent: "center" },
  hero: { gap: 8 },
  actions: { gap: 12 },
});
