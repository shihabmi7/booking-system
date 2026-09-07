import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Alert, Image, ScrollView, StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { cancelBooking, getBooking } from "@/api/bookings";
import { useAuthedFetch } from "@/auth/useAuthedFetch";
import { useCustomerAuth } from "@/auth/CustomerAuthContext";
import { BookingStatusChip } from "@/components/BookingStatusChip";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Skeleton } from "@/components/Skeleton";
import { formatDateTime } from "@/utils/dates";
import { formatPrice } from "@/utils/currency";

function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

// Public/unauthenticated on purpose, matching backend/src/routes/bookings.ts's GET
// /:bookingRef and the web app's identical choice (frontend/src/pages/BookingDetailsPage.tsx,
// not wrapped in RequireCustomerAuth) — a real QR scan links straight into this screen with no
// login involved. Reached three ways here: booking Confirm's success (router.replace), a row
// tap in My Bookings, and back from Reschedule.
//
// Cancel/Reschedule are only shown when the CURRENT session's customer owns this booking and it
// is still BOOKED — a signed-out viewer (or a customer viewing someone else's shared link, if
// that were ever possible) sees the same read-only details a QR scan does.
export default function BookingDetailsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { bookingRef } = useLocalSearchParams<{ bookingRef: string }>();
  const { customer } = useCustomerAuth();
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["booking", bookingRef],
    queryFn: () => getBooking(bookingRef),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelBooking(authedFetch, bookingRef),
    onSuccess: (updated) => {
      queryClient.setQueryData(["booking", bookingRef], updated);
      void queryClient.invalidateQueries({ queryKey: ["customerBookings"] });
    },
    onError: (err) => {
      Alert.alert(t("errors.unexpected"), err instanceof ApiError ? err.message : t("errors.network"));
    },
  });

  function confirmCancel() {
    if (!query.data) return;
    // RN has no window.confirm equivalent — Alert.alert with a destructive action button is
    // the native pattern both platforms use for "are you sure," matching the web app's
    // window.confirm() at the same decision point (CustomerBookingsPage/BookingDetailsPage).
    Alert.alert(
      t("bookingDetails.cancelConfirmTitle"),
      t("bookingDetails.cancelConfirmMessage", { service: query.data.service.name }),
      [
        { text: t("common.cancel"), style: "cancel" },
        { text: t("bookingDetails.cancelConfirmAction"), style: "destructive", onPress: () => cancelMutation.mutate() },
      ],
    );
  }

  const isOwner = !!(customer && query.data && query.data.customerId === customer.id);
  const canModify = isOwner && query.data?.status === "BOOKED";

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {query.isPending && (
        <View style={styles.content} accessibilityLabel={t("common.loading")}>
          <Skeleton width="30%" height={28} />
          <Skeleton width="70%" />
          <Skeleton width="50%" />
          <Skeleton width="80%" />
          <Skeleton width="60%" />
          <Skeleton width="50%" />
          <Skeleton width={200} height={200} style={styles.qrSkeleton} />
        </View>
      )}

      {query.isError && (
        <View style={styles.center}>
          <Text style={{ color: theme.colors.error }}>
            {query.error instanceof ApiError && query.error.status === 404
              ? t("bookingDetails.notFound")
              : t("bookingDetails.loadError")}
          </Text>
        </View>
      )}

      {query.isSuccess && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.statusRow}>
            <Text style={[styles.rowLabel, { color: theme.colors.onSurfaceVariant }]}>
              {t("bookingDetails.status")}
            </Text>
            <BookingStatusChip status={query.data.status} />
          </View>
          <DetailRow label={t("bookingDetails.reference")} value={query.data.bookingRef} />
          <DetailRow label={t("bookingDetails.customer")} value={query.data.customerName} />
          <DetailRow
            label={t("bookingDetails.service")}
            value={t("bookingDetails.serviceValue", {
              name: query.data.service.name,
              duration: query.data.service.durationMins,
              price: formatPrice(query.data.service.price),
            })}
          />
          <DetailRow
            label={t("bookingDetails.provider")}
            value={`${query.data.resource.business.name}, ${query.data.resource.name}`}
          />
          <DetailRow label={t("bookingDetails.time")} value={formatDateTime(query.data.startTime, i18n.language)} />

          {query.data.status === "BOOKED" && (
            <Card mode="outlined" style={styles.qrCard}>
              <Card.Content style={styles.qrCardContent}>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t("bookingDetails.qrCaption")}
                </Text>
                <Image
                  source={{ uri: query.data.qrCode }}
                  style={styles.qrImage}
                  accessibilityLabel={t("bookingDetails.qrAccessibilityLabel", { ref: query.data.bookingRef })}
                />
              </Card.Content>
            </Card>
          )}

          {canModify && (
            <View style={styles.actions}>
              <PrimaryButton mode="text" loading={false} onPress={() => router.push(`/bookings/${bookingRef}/reschedule`)}>
                {t("bookingDetails.reschedule.action")}
              </PrimaryButton>
              <PrimaryButton
                mode="text"
                textColor={theme.colors.error}
                loading={cancelMutation.isPending}
                onPress={confirmCancel}
              >
                {t("bookingDetails.cancelAction")}
              </PrimaryButton>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  content: { padding: 16, gap: 12 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  rowLabel: { minWidth: 90 },
  rowValue: { flex: 1 },
  qrCard: { marginTop: 12, alignSelf: "center" },
  qrCardContent: { alignItems: "center", gap: 12 },
  qrImage: { width: 200, height: 200 },
  qrSkeleton: { alignSelf: "center", marginTop: 12 },
  actions: { flexDirection: "row", justifyContent: "center", gap: 8, marginTop: 12 },
});
