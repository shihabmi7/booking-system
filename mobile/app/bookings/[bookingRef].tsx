import { useQuery } from "@tanstack/react-query";
import { Stack, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { getBooking } from "@/api/bookings";
import { BookingStatusChip } from "@/components/BookingStatusChip";
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
// login involved. Reached two ways here: booking Confirm's success (router.replace), and a row
// tap in My Bookings (Phase 4) — one screen, not two, same reuse the web app makes.
export default function BookingDetailsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { bookingRef } = useLocalSearchParams<{ bookingRef: string }>();

  const query = useQuery({
    queryKey: ["booking", bookingRef],
    queryFn: () => getBooking(bookingRef),
  });

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: t("bookingDetails.title"), headerShown: true }} />

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
});
