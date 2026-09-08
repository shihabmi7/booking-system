import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, StyleSheet, View } from "react-native";
import { Card, IconButton, SegmentedButtons, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

import { addFavorite, getFavorites, removeFavorite, type FavoriteService } from "@/api/favorites";
import { getServices, type Service } from "@/api/services";
import { useAuthedFetch } from "@/auth/useAuthedFetch";
import { CardSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { formatPrice } from "@/utils/currency";

type Filter = "all" | "favorites";

// Step 1 of the Book flow: every service across every business/resource, public data (no auth
// needed to browse — matches web's ServicesPage/BookPage). Tapping one carries everything the
// next two screens need as route params, so neither has to re-fetch or re-search this list.
//
// Favoriting (added after the initial Phase 3 build — see mobile-app-plan.md's audit note) is
// one heart toggle per row plus an All/Favorites filter over this SAME list, rather than a
// separate favorites screen — matching the backend's own GET /api/favorites comment: the
// favorited Service is the same shape, so one row renderer covers both views.
export default function ServicesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const services = useQuery({ queryKey: ["services"], queryFn: getServices });
  const favorites = useQuery({ queryKey: ["favorites"], queryFn: () => getFavorites(authedFetch) });
  const favoriteIds = new Set((favorites.data ?? []).map((f) => f.id));

  const toggleFavorite = useMutation<unknown, Error, string, { previous?: FavoriteService[] }>({
    mutationFn: (serviceId) =>
      favoriteIds.has(serviceId) ? removeFavorite(authedFetch, serviceId) : addFavorite(authedFetch, serviceId),
    // Optimistic: both endpoints are safe to retry (upsert / deleteMany server-side — see
    // backend/src/routes/favorites.ts), so there's nothing to roll back to on failure beyond
    // re-syncing from the server, which the onError below does.
    onMutate: async (serviceId) => {
      await queryClient.cancelQueries({ queryKey: ["favorites"] });
      const previous = queryClient.getQueryData<FavoriteService[]>(["favorites"]);
      const service = services.data?.find((s) => s.id === serviceId);
      queryClient.setQueryData<FavoriteService[]>(["favorites"], (current = []) =>
        favoriteIds.has(serviceId)
          ? current.filter((f) => f.id !== serviceId)
          : service
            ? [{ ...service, favoritedAt: new Date().toISOString() }, ...current]
            : current,
      );
      return { previous };
    },
    onError: (_err, _serviceId, context) => {
      if (context?.previous) queryClient.setQueryData(["favorites"], context.previous);
    },
  });

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

  const visibleServices =
    services.data && filter === "favorites" ? services.data.filter((s) => favoriteIds.has(s.id)) : services.data;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {services.isSuccess && services.data.length > 0 && (
        <View style={styles.filterRow}>
          <SegmentedButtons
            value={filter}
            onValueChange={(value) => setFilter(value as Filter)}
            buttons={[
              { value: "all", label: t("book.services.filterAll") },
              { value: "favorites", label: t("book.services.filterFavorites") },
            ]}
          />
        </View>
      )}

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

      {services.isSuccess && services.data.length > 0 && visibleServices?.length === 0 && (
        <EmptyState icon="heart-outline" message={t("book.services.noFavorites")} />
      )}

      {services.isSuccess && visibleServices && visibleServices.length > 0 && (
        <FlatList
          data={visibleServices}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isFavorited = favoriteIds.has(item.id);
            return (
              <Card mode="outlined" onPress={() => selectService(item)} accessibilityRole="button">
                <Card.Content style={styles.cardContent}>
                  <View style={styles.cardMain}>
                    <Text variant="titleMedium">{item.name}</Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                      {t("book.services.priceDuration", {
                        duration: item.durationMins,
                        price: formatPrice(item.price),
                      })}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {item.resource.business.name} — {item.resource.name}
                    </Text>
                  </View>
                  <IconButton
                    icon={isFavorited ? "heart" : "heart-outline"}
                    iconColor={isFavorited ? theme.colors.error : theme.colors.onSurfaceVariant}
                    size={28}
                    onPress={() => toggleFavorite.mutate(item.id)}
                    accessibilityLabel={
                      isFavorited ? t("book.services.unfavorite") : t("book.services.favorite")
                    }
                  />
                </Card.Content>
              </Card>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  list: { padding: 16, gap: 12 },
  filterRow: { paddingHorizontal: 16, paddingTop: 16 },
  cardContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardMain: { flex: 1, gap: 2 },
});
