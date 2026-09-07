import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import { Button } from "react-native-paper";

// The one submit-button styling (contained, disabled+spinner while in flight) every auth screen
// uses — collapsing it stops five screens from re-deciding the same mode/disabled/loading trio.
export function PrimaryButton({
  onPress,
  loading,
  disabled,
  mode = "contained",
  textColor,
  children,
}: {
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
  mode?: "contained" | "text";
  // For a destructive text-mode action (e.g. "Cancel booking") — Paper's Button has no
  // built-in "error" color variant the way MUI's Button color="error" does.
  textColor?: string;
  children: ReactNode;
}) {
  return (
    <Button
      mode={mode}
      onPress={onPress}
      loading={loading}
      disabled={loading || disabled}
      textColor={textColor}
      style={styles.button}
    >
      {children}
    </Button>
  );
}

const styles = StyleSheet.create({ button: { marginTop: 8 } });
