import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import type { Slot } from "@/api/slots";
import { DateSlotPicker } from "@/components/DateSlotPicker";

// Step 2 of the Book flow — the date/slot picker itself is shared with Reschedule, see
// src/components/DateSlotPicker.tsx.
export default function SlotsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    resourceId: string;
    serviceId: string;
    serviceName: string;
    durationMins: string;
    price: string;
    resourceName: string;
    businessName: string;
  }>();

  function selectSlot(slot: Slot) {
    router.push({
      pathname: "/(tabs)/book/confirm",
      params: { ...params, startTime: slot.startTime },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Text variant="titleMedium">{params.serviceName}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {params.businessName} — {params.resourceName}
        </Text>
      </View>

      <DateSlotPicker resourceId={params.resourceId} serviceId={params.serviceId} onSelectSlot={selectSlot} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 4 },
  header: { gap: 2, marginBottom: 8 },
});
