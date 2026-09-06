import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";

import { LANGUAGE_STORAGE_KEY, initI18n, resolveInitialLanguage, setLanguage } from "@/i18n";

jest.mock("expo-localization", () => ({ getLocales: jest.fn() }));
const mockGetLocales = jest.mocked(getLocales);

// expo-localization's Locale has a dozen fields (region, script, currency, measurement system);
// resolveInitialLanguage reads exactly one of them, so the cast keeps each test to the field under
// test instead of a wall of irrelevant filler.
function deviceLanguage(languageCode: string | null) {
  mockGetLocales.mockReturnValue([{ languageCode }] as unknown as ReturnType<typeof getLocales>);
}

describe("resolveInitialLanguage", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    deviceLanguage("en");
  });

  it("uses a supported device language when nothing is stored", async () => {
    deviceLanguage("bn");

    await expect(resolveInitialLanguage()).resolves.toBe("bn");
  });

  // The device is set to a language this app doesn't ship. Falling back rather than trying to load
  // a missing resource bundle is what keeps a French phone from opening to a screen of raw keys.
  it("falls back to English for an unsupported device language", async () => {
    deviceLanguage("fr");

    await expect(resolveInitialLanguage()).resolves.toBe("en");
  });

  it("falls back to English when the device reports no language at all", async () => {
    deviceLanguage(null);

    await expect(resolveInitialLanguage()).resolves.toBe("en");
  });

  // The important one: a deliberate choice has to survive a restart, or the switcher looks broken.
  it("prefers a stored choice over the device language", async () => {
    deviceLanguage("en");
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, "ms");

    await expect(resolveInitialLanguage()).resolves.toBe("ms");
  });

  it("ignores a stored value that is no longer supported", async () => {
    deviceLanguage("bn");
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, "de");

    await expect(resolveInitialLanguage()).resolves.toBe("bn");
  });
});

describe("setLanguage", () => {
  // Needs a live i18next instance: changeLanguage on an uninitialised one throws. That matches the
  // app, where the root layout awaits initI18n() before anything can render a switcher.
  beforeEach(async () => {
    deviceLanguage("en");
    await AsyncStorage.clear();
    await initI18n();
  });

  afterEach(async () => {
    await setLanguage("en");
  });

  it("persists the choice so the next launch keeps it", async () => {
    await setLanguage("bn");

    await expect(AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).resolves.toBe("bn");
  });
});
