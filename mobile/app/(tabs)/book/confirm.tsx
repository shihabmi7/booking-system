import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { ApiError } from "@/api/client";
import { createBooking } from "@/api/bookings";
import { useAuthedFetch } from "@/auth/useAuthedFetch";
import { useCustomerAuth } from "@/auth/CustomerAuthContext";
import { ErrorBanner } from "@/components/ErrorBanner";
import { PrimaryButton } from "@/components/PrimaryButton";
import { formatPrice } from "@/utils/currency";
import { formatDateTime } from "@/utils/dates";
import { generateIdempotencyKey } from "@/utils/idempotencyKey";

// Step 3 of the Book flow — a review screen before the POST actually fires, matching the web
// app's BookPage confirmation section (customer identity shown read-only, sourced from the
// logged-in profile, never re-typed here).
export default function ConfirmScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { customer } = useCustomerAuth();
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{
    resourceId: string;
    serviceId: string;
    serviceName: string;
    durationMins: string;
    price: string;
    resourceName: string;
    businessName: string;
    startTime: string;
  }>();

  // Generated once per mount, not per submit attempt — a retried submit (after a timeout, or
  // the user double-tapping) must reuse the SAME key so the backend's idempotency check
  // recognizes it as the same request, not a second booking. See backend/src/services/
  // bookingCreation.ts.
  const idempotencyKey = useRef(generateIdempotencyKey()).current;
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      createBooking(authedFetch, {
        resourceId: params.resourceId,
        serviceId: params.serviceId,
        startTime: params.startTime,
        idempotencyKey,
      }),
    onSuccess: (booking) => {
      router.replace(`/bookings/${booking.bookingRef}`);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t("errors.network"));
      if (err instanceof ApiError && err.status === 409) {
        // Someone else took this slot, or it just became a holiday, between loading it and
        // confirming — invalidate so a "choose another time" trip back to Slots shows reality.
        void queryClient.invalidateQueries({ queryKey: ["slots", params.resourceId, params.serviceId] });
      }
    },
  });

  if (!customer) return null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <Card mode="outlined">
        <Card.Content style={styles.details}>
          <Text variant="titleMedium">{params.serviceName}</Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            {params.businessName} — {params.resourceName}
          </Text>
          <Text style={{ color: theme.colors.onSurfaceVariant }}>
            {t("book.services.priceDuration", {
              duration: params.durationMins,
              price: formatPrice(params.price),
            })}
          </Text>
          <Text variant="titleSmall" style={styles.time}>
            {formatDateTime(params.startTime, i18n.language)}
          </Text>
        </Card.Content>
      </Card>

      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        {t("book.confirm.bookingAs", { name: customer.name, email: customer.email })}
      </Text>

      <ErrorBanner message={error} />

      <View style={styles.submit}>
        <PrimaryButton loading={mutation.isPending} onPress={() => mutation.mutate()}>
          {mutation.isPending ? t("book.confirm.submitting") : t("book.confirm.submit")}
        </PrimaryButton>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 16 },
  details: { gap: 4 },
  time: { marginTop: 8 },
  submit: { marginTop: "auto" },
});
