import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { API_BASE_URL } from "@/api/config";
import { getHealth } from "@/api/health";

// The Phase 0 milestone screen: it exists to prove the app can reach the backend from a real
// emulator, and it prints the resolved base URL because "Network request failed" on its own never
// tells you WHICH host the app tried. Phase 2 replaces this with the auth entry point.
export default function ConnectionCheckScreen() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  });

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Booking System</Text>
      <Text style={styles.subtitle}>{API_BASE_URL}</Text>

      <View style={styles.status}>
        {health.isPending && <ActivityIndicator accessibilityLabel="Checking backend" />}

        {health.isSuccess && (
          <Text style={styles.ok}>
            Backend reachable{"\n"}
            {health.data.dbConnected ? "Database connected" : "Database NOT connected"}
          </Text>
        )}

        {health.isError && (
          <Text style={styles.error}>
            Could not reach the backend{"\n"}
            {health.error.message}
          </Text>
        )}
      </View>

      <Pressable
        style={styles.button}
        onPress={() => health.refetch()}
        accessibilityRole="button"
        disabled={health.isFetching}
      >
        <Text style={styles.buttonLabel}>Check again</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  title: { fontSize: 28, fontWeight: "600" },
  subtitle: { fontSize: 13, opacity: 0.6 },
  status: { minHeight: 72, justifyContent: "center" },
  ok: { fontSize: 16, textAlign: "center", color: "#1B7F3B" },
  error: { fontSize: 14, textAlign: "center", color: "#B3261E" },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: "#208AEF",
  },
  buttonLabel: { color: "#fff", fontSize: 16, fontWeight: "500" },
});
