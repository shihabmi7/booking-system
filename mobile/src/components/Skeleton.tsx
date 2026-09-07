import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "react-native-paper";

/**
 * A pulsing placeholder block — Phase 6's replacement for the bare `ActivityIndicator` every
 * list used through Phases 3-5. A spinner tells you "something is loading"; a skeleton shaped
 * like the eventual content tells you WHAT is loading and roughly how much of it, which is why
 * it belongs on lists specifically (services, bookings) rather than one-shot forms.
 */
export function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: theme.colors.surfaceVariant },
        animatedStyle,
        style,
      ]}
    />
  );
}

// A pre-shaped stand-in for one service/booking card — used everywhere a list renders one of
// those while loading, so the skeleton and the eventual real card occupy the same footprint and
// nothing visibly jumps when the data arrives.
export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton width="60%" height={20} />
      <Skeleton width="40%" height={14} />
      <Skeleton width="80%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "transparent" },
});
