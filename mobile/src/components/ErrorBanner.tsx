import { StyleSheet } from "react-native";
import { Text, useTheme } from "react-native-paper";

// A plain inline banner rather than Paper's <Banner> (which is a full-width, dismiss-by-default
// component meant for app-level notices) — every auth screen just needs one line of red text
// under the form, in the same spot Alert occupied on the web pages this mirrors.
export function ErrorBanner({ message }: { message: string | null }) {
  const theme = useTheme();
  if (!message) return null;

  return (
    <Text
      variant="bodyMedium"
      accessibilityRole="alert"
      style={[styles.text, { color: theme.colors.error }]}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({ text: { marginTop: 4 } });
