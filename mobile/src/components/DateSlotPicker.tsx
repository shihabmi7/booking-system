import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, View } from "react-native";
import { Chip, Text } from "react-native-paper";

import { getSlots, type Slot } from "@/api/slots";
import { formatDateChipLabel, formatTime, upcomingDateKeys } from "@/utils/dates";
import { EmptyState } from "./EmptyState";
import { Skeleton } from "./Skeleton";

const DATE_STRIP_LENGTH = 14;

/**
 * The date-strip + open-slots grid shared by Book's own slot picker
 * (app/(tabs)/book/slots.tsx) and Reschedule (app/bookings/[bookingRef]/reschedule.tsx) — both
 * screens are "pick a new time for this exact resource+service," just followed by a different
 * next step (confirm a new booking vs. PATCH an existing one), so only the slot-picking UI itself
 * is worth sharing, not the screen around it.
 */
export function DateSlotPicker({
  resourceId,
  serviceId,
  onSelectSlot,
}: {
  resourceId: string;
  serviceId: string;
  onSelectSlot: (slot: Slot) => void;
}) {
  const { t, i18n } = useTranslation();
  const dateKeys = upcomingDateKeys(DATE_STRIP_LENGTH);
  const [selectedDate, setSelectedDate] = useState(dateKeys[0]);

  const slotsQuery = useQuery({
    queryKey: ["slots", resourceId, serviceId, selectedDate],
    queryFn: () => getSlots(resourceId, serviceId, selectedDate),
  });

  return (
    <View>
      <Text variant="labelLarge" style={styles.sectionLabel}>
        {t("book.slots.selectDate")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
        {dateKeys.map((dateKey) => (
          <Chip key={dateKey} selected={dateKey === selectedDate} onPress={() => setSelectedDate(dateKey)}>
            {formatDateChipLabel(dateKey, i18n.language)}
          </Chip>
        ))}
      </ScrollView>

      <View style={styles.slotsSection}>
        {slotsQuery.isPending && (
          <View style={styles.slotsGrid} accessibilityLabel={t("common.loading")}>
            <Skeleton width={72} height={32} borderRadius={16} />
            <Skeleton width={72} height={32} borderRadius={16} />
            <Skeleton width={72} height={32} borderRadius={16} />
            <Skeleton width={72} height={32} borderRadius={16} />
          </View>
        )}

        {slotsQuery.isError && <Text>{t("book.slots.loadError")}</Text>}

        {slotsQuery.isSuccess && slotsQuery.data.note && (
          <EmptyState icon="calendar-remove-outline" message={slotsQuery.data.note} />
        )}

        {slotsQuery.isSuccess && !slotsQuery.data.note && slotsQuery.data.slots.length === 0 && (
          <EmptyState icon="clock-outline" message={t("book.slots.noSlots")} />
        )}

        {slotsQuery.isSuccess && slotsQuery.data.slots.length > 0 && (
          <>
            <Text variant="labelLarge" style={styles.sectionLabel}>
              {t("book.slots.availableTimes")}
            </Text>
            <View style={styles.slotsGrid}>
              {slotsQuery.data.slots.map((slot) => (
                <Chip key={slot.startTime} onPress={() => onSelectSlot(slot)}>
                  {formatTime(slot.startTime, i18n.language)}
                </Chip>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: 12, marginBottom: 8 },
  dateStrip: { gap: 8, paddingRight: 16 },
  slotsSection: { marginTop: 4 },
  slotsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
