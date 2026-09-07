import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { ActivityIndicator, Chip, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { getSlots, type Slot } from "@/api/slots";
import { formatDateChipLabel, formatTime, upcomingDateKeys } from "@/utils/dates";

const DATE_STRIP_LENGTH = 14;

// Step 2 of the Book flow. A rolling date strip (see utils/dates.ts for why, not a full
// calendar) plus the open slots for whichever date is selected — reruns the query on every
// date change, the same "re-fetch slots on service/date change" behavior BookPage has on web.
export default function SlotsScreen() {
  const { t, i18n } = useTranslation();
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

  const dateKeys = upcomingDateKeys(DATE_STRIP_LENGTH);
  const [selectedDate, setSelectedDate] = useState(dateKeys[0]);

  const slotsQuery = useQuery({
    queryKey: ["slots", params.resourceId, params.serviceId, selectedDate],
    queryFn: () => getSlots(params.resourceId, params.serviceId, selectedDate),
  });

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

      <Text variant="labelLarge" style={styles.sectionLabel}>
        {t("book.slots.selectDate")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
        {dateKeys.map((dateKey) => (
          <Chip
            key={dateKey}
            selected={dateKey === selectedDate}
            onPress={() => setSelectedDate(dateKey)}
            style={styles.dateChip}
          >
            {formatDateChipLabel(dateKey, i18n.language)}
          </Chip>
        ))}
      </ScrollView>

      <View style={styles.slotsSection}>
        {slotsQuery.isPending && <ActivityIndicator accessibilityLabel={t("common.loading")} />}

        {slotsQuery.isError && <Text style={{ color: theme.colors.error }}>{t("book.slots.loadError")}</Text>}

        {slotsQuery.isSuccess && slotsQuery.data.note && (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{slotsQuery.data.note}</Text>
        )}

        {slotsQuery.isSuccess && !slotsQuery.data.note && slotsQuery.data.slots.length === 0 && (
          <Text style={{ color: theme.colors.onSurfaceVariant }}>{t("book.slots.noSlots")}</Text>
        )}

        {slotsQuery.isSuccess && slotsQuery.data.slots.length > 0 && (
          <>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              {t("book.slots.availableTimes")}
            </Text>
            <View style={styles.slotsGrid}>
              {slotsQuery.data.slots.map((slot) => (
                <Chip key={slot.startTime} onPress={() => selectSlot(slot)}>
                  {formatTime(slot.startTime, i18n.language)}
                </Chip>
              ))}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 4 },
  header: { gap: 2, marginBottom: 8 },
  sectionLabel: { marginTop: 12, marginBottom: 8 },
  dateStrip: { gap: 8, paddingRight: 16 },
  dateChip: {},
  slotsSection: { marginTop: 4 },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
