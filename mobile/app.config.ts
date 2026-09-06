import type { ExpoConfig } from "expo/config";

// Replaces the template's static app.json so the API base URL can come from the environment
// instead of being hardcoded per build. Everything else here is the template's config verbatim.
//
// EXPO_PUBLIC_* is Expo's own convention: the value is inlined into the JS bundle at build time.
// Nothing secret may go in one — this is a URL, which is fine. It is ALSO surfaced under `extra`
// so `src/api/config.ts` can read it via expo-constants, which keeps the "where does the base URL
// come from" answer in one file rather than scattering process.env reads through the API layer.
const config: ExpoConfig = {
  name: "Booking System",
  slug: "booking-system-customer",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "bookingsystem",
  userInterfaceStyle: "automatic",
  ios: {
    icon: "./assets/expo.icon",
    supportsTablet: true,
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    // Required by expo-localization for the native locale lookup getLocales() reads.
    "expo-localization",
    // Required for the config plugin to set Android's `android:allowBackup="false"` — the JWT
    // stored via SecureStore lives in the Keystore, but without this a full device backup could
    // still round-trip the SharedPreferences file SecureStore uses to reference it.
    "expo-secure-store",
    [
      "expo-splash-screen",
      {
        backgroundColor: "#208AEF",
        image: "./assets/images/splash-icon.png",
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    // Deliberately allowed to be undefined — src/api/config.ts falls back to a per-platform
    // localhost default so `npm run android` / `npm run ios` work with no .env file at all.
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  },
};

export default config;
