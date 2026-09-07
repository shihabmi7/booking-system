import { MD3DarkTheme, MD3LightTheme, configureFonts, type MD3Theme } from "react-native-paper";

import type { Language } from "@/i18n";

/**
 * The web app's palette (frontend/src/theme.ts) expressed as a Material 3 scheme: a clinical teal
 * primary, warm amber secondary. Keeping the two apps visually the same is the point — a customer
 * who books on the web and then installs the app should recognise it.
 *
 * Each theme spreads Paper's own MD3 colors first. MD3 defines far more color roles than the four
 * MUI ones this project picked (containers, inverse surfaces, elevation levels); overriding only
 * the roles we have opinions about leaves Paper's defaults doing the work for the rest, instead of
 * hand-inventing thirty hex values that would drift out of tune with each other.
 */
const lightColors: MD3Theme["colors"] = {
  ...MD3LightTheme.colors,
  primary: "#0f6e56",
  onPrimary: "#ffffff",
  primaryContainer: "#a8f2d6",
  onPrimaryContainer: "#00201a",
  secondary: "#b26a00",
  onSecondary: "#ffffff",
  secondaryContainer: "#ffddb3",
  onSecondaryContainer: "#2a1800",
  background: "#f4f6f5",
  onBackground: "#191c1b",
  surface: "#ffffff",
  onSurface: "#191c1b",
  surfaceVariant: "#dbe5e0",
  onSurfaceVariant: "#3f4946",
  outline: "#6f7975",
};

// Not the light colors dimmed: Material 3 dark themes swap the roles, so the brand teal becomes a
// light tint used ON dark surfaces, and the deep teal becomes the container behind it. Reusing
// #0f6e56 as the dark-mode primary would fail contrast against a near-black background.
const darkColors: MD3Theme["colors"] = {
  ...MD3DarkTheme.colors,
  primary: "#8bd6b8",
  onPrimary: "#00382b",
  primaryContainer: "#00513f",
  onPrimaryContainer: "#a8f2d6",
  secondary: "#ffb951",
  onSecondary: "#4a2800",
  secondaryContainer: "#6a3c00",
  onSecondaryContainer: "#ffddb3",
  background: "#191c1b",
  onBackground: "#e1e3e1",
  surface: "#191c1b",
  onSurface: "#e1e3e1",
  surfaceVariant: "#3f4946",
  onSurfaceVariant: "#bfc9c4",
  outline: "#899390",
};

export const BENGALI_FONT_FAMILY = "NotoSansBengali_400Regular";

/**
 * Bangla is the reason the theme depends on the active language at all.
 *
 * A device's default UI font does not reliably include Bengali glyphs — on the devices where it
 * doesn't, every Bangla string renders as tofu boxes, which looks like a broken app rather than a
 * missing font. Applying the bundled Noto Sans Bengali only for `bn` keeps English and Malay on
 * the platform's own font, which is what they should use.
 */
export function buildTheme(scheme: "light" | "dark", language: Language): MD3Theme {
  const base = scheme === "dark" ? MD3DarkTheme : MD3LightTheme;

  return {
    ...base,
    colors: scheme === "dark" ? darkColors : lightColors,
    fonts:
      language === "bn"
        ? configureFonts({ config: { fontFamily: BENGALI_FONT_FAMILY } })
        : base.fonts,
  };
}
