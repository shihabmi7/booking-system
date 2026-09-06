import { NotoSansBengali_400Regular } from "@expo-google-fonts/noto-sans-bengali";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useColorScheme } from "react-native";
import { PaperProvider } from "react-native-paper";

import { queryClient } from "@/api/queryClient";
import { initI18n, type Language } from "@/i18n";
import { buildTheme } from "@/theme";

// Held until the fonts and the stored language are both loaded. Rendering before i18next is ready
// would flash raw translation keys, and rendering before the font loads would flash tofu boxes for
// a Bangla user — both look like bugs, and both last just long enough to be noticed.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const [fontsLoaded] = useFonts({ NotoSansBengali_400Regular });

  useEffect(() => {
    void initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (i18nReady && fontsLoaded) void SplashScreen.hideAsync();
  }, [i18nReady, fontsLoaded]);

  if (!i18nReady || !fontsLoaded) return null;

  return <App />;
}

// A separate component purely so useTranslation() runs below the point where i18next is known to
// be initialised — calling it above would subscribe to an instance that has no resources yet.
function App() {
  const { i18n } = useTranslation();
  // Not `?? "light"`: the hook can also return "unspecified", so anything that is not explicitly
  // dark is treated as light rather than being narrowed away by a null check alone.
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const theme = buildTheme(scheme, i18n.language as Language);

  return (
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={theme}>
        <Stack
          screenOptions={{
            headerShown: false,
            // The navigator paints its own background behind every screen; without this it stays
            // white in dark mode and flashes on each transition.
            contentStyle: { backgroundColor: theme.colors.background },
          }}
        />
        <StatusBar style="auto" />
      </PaperProvider>
    </QueryClientProvider>
  );
}
