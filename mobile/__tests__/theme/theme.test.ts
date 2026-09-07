import AsyncStorage from "@react-native-async-storage/async-storage";

import { BENGALI_FONT_FAMILY, buildTheme } from "@/theme";

describe("buildTheme", () => {
  it("applies the bundled Bengali font only for Bangla", () => {
    const bangla = buildTheme("light", "bn");
    const english = buildTheme("light", "en");

    expect(bangla.fonts.bodyMedium.fontFamily).toBe(BENGALI_FONT_FAMILY);
    expect(english.fonts.bodyMedium.fontFamily).not.toBe(BENGALI_FONT_FAMILY);
  });

  // Material 3 dark themes swap the color roles rather than dimming them, so the dark primary is a
  // light tint meant to sit ON a dark surface. If this ever comes back equal to the light primary,
  // the brand teal is being painted on near-black and contrast is broken.
  it("uses a different primary in dark mode than in light mode", () => {
    expect(buildTheme("dark", "en").colors.primary).not.toBe(
      buildTheme("light", "en").colors.primary,
    );
  });

  it("keeps the web app's teal as the light-mode primary", () => {
    expect(buildTheme("light", "en").colors.primary).toBe("#0f6e56");
  });

  it("does not touch storage — theming is derived, not persisted", async () => {
    buildTheme("dark", "bn");

    await expect(AsyncStorage.getAllKeys()).resolves.not.toContain("settings.theme");
  });
});
