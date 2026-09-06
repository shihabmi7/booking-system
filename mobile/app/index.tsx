import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Button, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_BASE_URL } from "@/api/config";
import { getHealth } from "@/api/health";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// The Phase 0 milestone screen, now on Paper and translated — it doubles as the proof that the
// theme and all three locales actually work on a device. It prints the resolved base URL because
// "Network request failed" on its own never tells you WHICH host the app tried. Phase 2 replaces
// this with the auth entry point.
export default function ConnectionCheckScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const health = useQuery({ queryKey: ["health"], queryFn: getHealth });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineMedium">{t("appName")}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {API_BASE_URL}
        </Text>
      </View>

      <Card mode="outlined" style={styles.card}>
        <Card.Content style={styles.cardContent}>
          {health.isPending && <ActivityIndicator accessibilityLabel={t("connection.checking")} />}

          {health.isSuccess && (
            <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
              {t("connection.reachable")}
              {"\n"}
              {t(health.data.dbConnected ? "connection.dbConnected" : "connection.dbDisconnected")}
            </Text>
          )}

          {health.isError && (
            <Text variant="bodyMedium" style={{ color: theme.colors.error }}>
              {t("connection.unreachable")}
              {"\n"}
              {health.error.message}
            </Text>
          )}
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        onPress={() => health.refetch()}
        loading={health.isFetching}
        disabled={health.isFetching}
      >
        {t("connection.checkAgain")}
      </Button>

      <LanguageSwitcher />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 20 },
  header: { alignItems: "center", gap: 4 },
  card: { width: "100%" },
  cardContent: { minHeight: 84, alignItems: "center", justifyContent: "center" },
});
