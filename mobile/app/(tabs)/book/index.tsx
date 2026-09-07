import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, View } from "react-native";
import { Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { getServices, type Service } from "@/api/services";
import { CardSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatPrice } from "@/utils/currency";

// Step 1 of the Book flow: every service across every business/resource, public data (no auth
// needed to browse — matches web's ServicesPage/BookPage). Tapping one carries everything the
// next two screens need as route params, so neither has to re-fetch or re-search this list.
export default function ServicesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const services = useQuery({ queryKey: ["services"], queryFn: getServices });

  function selectService(service: Service) {
    router.push({
      pathname: "/(tabs)/book/slots",
      params: {
        resourceId: service.resourceId,
        serviceId: service.id,
        serviceName: service.name,
        durationMins: String(service.durationMins),
        price: service.price,
        resourceName: service.resource.name,
        businessName: service.resource.business.name,
      },
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {services.isPending && (
        <View style={styles.list} accessibilityLabel={t("common.loading")}>
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </View>
      )}

      {services.isError && (
        <View style={styles.center}>
          <Text style={{ color: theme.colors.error }}>{t("book.services.loadError")}</Text>
        </View>
      )}

      {services.isSuccess && services.data.length === 0 && (
        <EmptyState icon="calendar-blank-outline" message={t("book.services.empty")} />
      )}

      {services.isSuccess && services.data.length > 0 && (
        <FlatList
          data={services.data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Card mode="outlined" onPress={() => selectService(item)} accessibilityRole="button">
              <Card.Content>
                <Text variant="titleMedium">{item.name}</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                  {t("book.services.priceDuration", { duration: item.durationMins, price: formatPrice(item.price) })}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {item.resource.business.name} — {item.resource.name}
                </Text>
              </Card.Content>
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
});
