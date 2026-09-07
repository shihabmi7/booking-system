import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { ActivityIndicator, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { getBooking, rescheduleBooking } from "@/api/bookings";
import type { Slot } from "@/api/slots";
import { useAuthedFetch } from "@/auth/useAuthedFetch";
import { DateSlotPicker } from "@/components/DateSlotPicker";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatDateTime } from "@/utils/dates";

// Same service/resource as the existing booking, just a new startTime — changing service or
// resource isn't supported here (that's a cancel + a fresh booking), matching the backend
// route's own comment. Reads the booking via the SAME query key the details screen uses
// (["booking", bookingRef]) so this screen doesn't need its own params passed through the URL —
// resourceId/serviceId/currentStartTime all come from that one fetch (or its cache).
export default function RescheduleScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { bookingRef } = useLocalSearchParams<{ bookingRef: string }>();
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const bookingQuery = useQuery({
    queryKey: ["booking", bookingRef],
    queryFn: () => getBooking(bookingRef),
  });

  const mutation = useMutation({
    mutationFn: (startTime: string) => rescheduleBooking(authedFetch, bookingRef, startTime),
    onSuccess: (updated) => {
      queryClient.setQueryData(["booking", bookingRef], updated);
      void queryClient.invalidateQueries({ queryKey: ["customerBookings"] });
      router.replace(`/bookings/${bookingRef}`);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t("errors.network")),
  });

  function selectSlot(slot: Slot) {
    setError(null);
    mutation.mutate(slot.startTime);
  }

  if (bookingQuery.isPending) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator accessibilityLabel={t("common.loading")} />
      </SafeAreaView>
    );
  }

  if (bookingQuery.isError || !bookingQuery.data) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ color: theme.colors.error }}>{t("bookingDetails.loadError")}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Text variant="titleMedium">{bookingQuery.data.service.name}</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>
          {t("bookingDetails.reschedule.currently", {
            time: formatDateTime(bookingQuery.data.startTime, i18n.language),
          })}
        </Text>
      </View>

      <ErrorBanner message={error} />

      {mutation.isPending ? (
        <View style={styles.center}>
          <ActivityIndicator accessibilityLabel={t("bookingDetails.reschedule.submitting")} />
        </View>
      ) : (
        <DateSlotPicker
          resourceId={bookingQuery.data.resourceId}
          serviceId={bookingQuery.data.serviceId}
          onSelectSlot={selectSlot}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  header: { gap: 2, marginBottom: 8 },
});
