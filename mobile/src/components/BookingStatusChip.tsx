import { useTranslation } from "react-i18next";
import { Chip, useTheme, type MD3Theme } from "react-native-paper";

import type { BookingStatus } from "@/api/bookings";

// Same status vocabulary the backend's state machine uses (backend/src/services/
// bookingStateMachine.ts) and the same color mapping the web app uses for it (STATUS_COLOR in
// frontend/src/pages/customer/CustomerBookingsPage.tsx and BookingDetailsPage.tsx) — expressed
// against Paper's MD3 color roles instead of MUI's palette keys.
function colorFor(theme: MD3Theme, status: BookingStatus) {
  switch (status) {
    case "BOOKED":
      return { bg: theme.colors.primaryContainer, fg: theme.colors.onPrimaryContainer };
    case "CHECKED_IN":
      return { bg: theme.colors.secondaryContainer, fg: theme.colors.onSecondaryContainer };
    case "COMPLETED":
      return { bg: theme.colors.primaryContainer, fg: theme.colors.onPrimaryContainer };
    case "NO_SHOW":
      return { bg: theme.colors.errorContainer, fg: theme.colors.onErrorContainer };
    case "CANCELLED":
      return { bg: theme.colors.surfaceVariant, fg: theme.colors.onSurfaceVariant };
  }
}

export function BookingStatusChip({ status }: { status: BookingStatus }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { bg, fg } = colorFor(theme, status);

  return (
    <Chip
      compact
      style={{ backgroundColor: bg }}
      textStyle={{ color: fg }}
      accessibilityLabel={t("bookings.status.label", { status: t(`bookings.status.${status}`) })}
    >
      {t(`bookings.status.${status}`)}
    </Chip>
  );
}
