import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

/**
 * An icon-led empty state rather than bare text ("No bookings yet") — the plan calls for
 * "empty-state illustrations," and a large muted icon plus a short message is the illustration
 * this app can afford without commissioning actual artwork or bundling new image assets.
 */
export function EmptyState({ icon, message }: { icon: string; message: string }) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon as never} size={64} color={theme.colors.outline} />
      <Text style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  message: { textAlign: "center" },
});
