import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { SegmentedButtons, Text } from "react-native-paper";

import { SUPPORTED_LANGUAGES, setLanguage, type Language } from "@/i18n";

/**
 * Every option is labelled in its OWN language — "English", "বাংলা", "Bahasa Melayu" — which is why
 * the `language.*` keys are identical in all three locale files rather than translated. Someone
 * looking for Bangla in an app currently showing Malay needs to find the word they recognise, not
 * the Malay word for Bangla.
 *
 * They are also kept short for that reason: three segments share one row, and the full endonym
 * "Bahasa Melayu" truncated to "Bahasa M…" on a Pixel 3.
 */
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation();

  return (
    <View style={styles.container}>
      <Text variant="labelLarge" style={styles.label}>
        {t("language.label")}
      </Text>
      <SegmentedButtons
        value={i18n.language}
        onValueChange={(value) => void setLanguage(value as Language)}
        buttons={SUPPORTED_LANGUAGES.map((language) => ({
          value: language,
          label: t(`language.${language}`),
          // Without this the buttons announce only their label, so a screen reader user hears
          // three language names with no indication of what selecting one does.
          accessibilityLabel: `${t("language.label")}: ${t(`language.${language}`)}`,
        }))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: 8 },
  label: { textAlign: "center" },
});
