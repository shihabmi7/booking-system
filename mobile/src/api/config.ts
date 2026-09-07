import Constants from "expo-constants";
import { Platform } from "react-native";

// "localhost" does not mean the same thing on a phone as it does in a desktop browser: on an
// Android emulator localhost is the EMULATOR itself, and the host machine is reachable only at
// the special alias 10.0.2.2. An iOS simulator shares the Mac's network stack, so localhost
// there really is the Mac. Getting this wrong produces a "Network request failed" with no
// further detail, which is a miserable thing to debug blind — hence a default per platform
// rather than one shared constant.
const DEV_FALLBACK_BASE_URL = Platform.select({
  android: "http://10.0.2.2:4000",
  default: "http://localhost:4000",
});

// A physical device is on neither of those: it needs the dev machine's LAN IP, which no default
// can guess. That is the case EXPO_PUBLIC_API_BASE_URL (via app.config.ts's `extra`) exists for.
const configured = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

export const API_BASE_URL = configured?.trim() ? configured.trim() : DEV_FALLBACK_BASE_URL;

// The profile picture endpoint (POST /api/customer/me/picture) returns a path relative to the
// backend, e.g. "/uploads/profile-pictures/xyz.png" — a browser's <img> resolves that against
// the current page origin for free, but React Native's <Image> has no origin to resolve
// against, so a relative uri just fails to load with no visible error. Already-absolute URLs
// (http/https) pass through untouched, since a future CDN-backed URL wouldn't need this at all.
export function resolveAssetUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;
}
