import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { useTheme } from "react-native-paper";

import { RequireCustomerAuth } from "@/auth/RequireCustomerAuth";

// The whole tab group is one RequireCustomerAuth boundary rather than each screen checking
// auth status individually — a signed-out customer can never see a flash of any tab, and every
// screen inside (Home, Book/*, Bookings/*, Profile/*) can assume a session already exists.
export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <RequireCustomerAuth>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
          tabBarStyle: { backgroundColor: theme.colors.surface },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("nav.home"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="book"
          options={{
            title: t("nav.book"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calendar-plus" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="bookings"
          options={{
            title: t("nav.bookings"),
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calendar-check" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("nav.profile"),
            tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="account" color={color} size={size} />,
          }}
        />
      </Tabs>
    </RequireCustomerAuth>
  );
}
