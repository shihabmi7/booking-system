import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, screen, userEvent } from "@testing-library/react-native";

import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import i18n, { LANGUAGE_STORAGE_KEY } from "@/i18n";
import { renderWithProviders } from "../utils/render";

describe("LanguageSwitcher", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  // Wrapped in act(): changeLanguage fires an i18next event that re-renders every mounted
  // component still subscribed via useTranslation, and React logs that as an unwrapped update.
  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  it("offers every supported language, each written in its own script", async () => {
    await renderWithProviders(<LanguageSwitcher />);

    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("বাংলা")).toBeTruthy();
    expect(screen.getByText("Melayu")).toBeTruthy();
  });

  it("switches the active language when an option is pressed", async () => {
    await renderWithProviders(<LanguageSwitcher />);

    await userEvent.press(screen.getByText("বাংলা"));

    expect(i18n.language).toBe("bn");
  });

  // Switching without persisting would look like it worked and then silently revert on the next
  // launch — the exact failure resolveInitialLanguage's stored-choice precedence exists to prevent.
  it("persists the choice", async () => {
    await renderWithProviders(<LanguageSwitcher />);

    await userEvent.press(screen.getByText("Melayu"));

    await expect(AsyncStorage.getItem(LANGUAGE_STORAGE_KEY)).resolves.toBe("ms");
  });

  it("re-renders its own label in the newly selected language", async () => {
    await renderWithProviders(<LanguageSwitcher />);
    expect(screen.getByText("Language")).toBeTruthy();

    await userEvent.press(screen.getByText("বাংলা"));

    expect(await screen.findByText("ভাষা")).toBeTruthy();
  });
});
