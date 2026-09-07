import { useMutation, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { cancelBooking, getMyBookings, type BookingSummary } from "@/api/bookings";
import { useAuthedFetch } from "@/auth/useAuthedFetch";
import { BookingStatusChip } from "@/components/BookingStatusChip";
import { EmptyState } from "@/components/EmptyState";
import { PrimaryButton } from "@/components/PrimaryButton";
import { CardSkeleton } from "@/components/Skeleton";
import { formatDateTime } from "@/utils/dates";

// Phase 4: GET /api/customer/bookings, scoped server-side to the logged-in customer — most
// recent first, no query params. FlatList (not a mapped ScrollView) specifically so
// pull-to-refresh and eventual long-list virtualization come for free, per the plan's screen
// spec for this tab. Cancel/Reschedule row actions (only while a booking is still BOOKED,
// matching web's CustomerBookingsPage) were added after the initial Phase 4 build — see the
// audit note in mobile-app-plan.md.
export default function MyBookingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const authedFetch = useAuthedFetch();

  const query = useQuery({
    queryKey: ["customerBookings"],
    queryFn: () => getMyBookings(authedFetch),
  });

  const cancelMutation = useMutation({
    mutationFn: (bookingRef: string) => cancelBooking(authedFetch, bookingRef),
    onSuccess: () => void query.refetch(),
    onError: (err) => {
      Alert.alert(t("errors.unexpected"), err instanceof ApiError ? err.message : t("errors.network"));
    },
  });

  function openBooking(booking: BookingSummary) {
    router.push(`/bookings/${booking.bookingRef}`);
  }

  function confirmCancel(booking: BookingSummary) {
    Alert.alert(
      t("bookingDetails.cancelConfirmTitle"),
      t("bookingDetails.cancelConfirmMessage", { service: booking.service.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("bookingDetails.cancelConfirmAction"),
          style: "destructive",
          onPress: () => cancelMutation.mutate(booking.bookingRef),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {query.isPending && (
        <View style={styles.list} accessibilityLabel={t("common.loading")}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      )}

      {query.isError && (
        <View style={styles.center}>
          <Text style={{ color: theme.colors.error }}>{t("bookings.loadError")}</Text>
        </View>
      )}

      {query.isSuccess && (
        <FlatList
          data={query.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={query.data.length === 0 ? styles.emptyList : styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />}
          ListEmptyComponent={<EmptyState icon="calendar-remove-outline" message={t("bookings.empty")} />}
          renderItem={({ item }) => (
            <Card mode="outlined" onPress={() => openBooking(item)} accessibilityRole="button">
              <Card.Content style={styles.row}>
                <View style={styles.rowMain}>
                  <Text variant="titleMedium">{item.service.name}</Text>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>
                    {formatDateTime(item.startTime, i18n.language)}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {item.resource.business.name}
                  </Text>
                </View>
                <BookingStatusChip status={item.status} />
              </Card.Content>

              {item.status === "BOOKED" && (
                <Card.Content style={styles.actionsRow}>
                  <PrimaryButton
                    mode="text"
                    loading={false}
                    onPress={() => router.push(`/bookings/${item.bookingRef}/reschedule`)}
                  >
                    {t("bookingDetails.reschedule.action")}
                  </PrimaryButton>
                  <PrimaryButton
                    mode="text"
                    textColor={theme.colors.error}
                    loading={cancelMutation.isPending && cancelMutation.variables === item.bookingRef}
                    onPress={() => confirmCancel(item)}
                  >
                    {t("bookingDetails.cancelAction")}
                  </PrimaryButton>
                </Card.Content>
              )}
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { padding: 16, gap: 12 },
  emptyList: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowMain: { flex: 1, gap: 2 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", gap: 4, paddingTop: 0 },
});
