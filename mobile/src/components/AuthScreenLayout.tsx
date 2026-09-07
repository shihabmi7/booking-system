import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Avatar, Card, Text, useTheme } from "react-native-paper";
import { SafeAreaView } from "react-native-safe-area-context";

// The shared shell every Register/Verify/Login/Forgot/Reset screen sits in — a centred card with
// an icon, title and optional subtitle above a form. Mirrors the web app's identical Card layout
// across its five customer auth pages (frontend/src/pages/customer/Customer*Page.tsx) so the two
// clients read as the same product, not a native reimplementation with its own conventions.
export function AuthScreenLayout({
  icon,
  title,
  subtitle,
  children,
  footer,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Card mode="outlined" style={styles.card}>
            <Card.Content>
              <View style={styles.header}>
                <Avatar.Icon icon={icon} size={48} />
                <Text variant="headlineSmall">{title}</Text>
                {subtitle && (
                  <Text
                    variant="bodyMedium"
                    style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
                  >
                    {subtitle}
                  </Text>
                )}
              </View>

              <View style={styles.form}>{children}</View>
            </Card.Content>
          </Card>

          {footer && <View style={styles.footer}>{footer}</View>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 16 },
  card: { width: "100%", maxWidth: 420, alignSelf: "center" },
  header: { alignItems: "center", gap: 8, marginBottom: 16 },
  subtitle: { textAlign: "center" },
  form: { gap: 4 },
  footer: { width: "100%", maxWidth: 420, alignSelf: "center", gap: 8 },
});
