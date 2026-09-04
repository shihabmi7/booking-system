import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { queryClient } from "@/api/queryClient";

// Deliberately a bare Stack for now. The tab navigator the plan calls for ((tabs) with Home /
// Book / Bookings / Profile) arrives with the screens that populate it — an empty tab bar over
// a single screen would be scaffolding pretending to be an app.
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </QueryClientProvider>
  );
}
