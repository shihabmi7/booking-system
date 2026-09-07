// YYYY-MM-DD in the device's local timezone — NOT toISOString().slice(0, 10), which is UTC and
// would show "tomorrow" as still selected past midnight in any timezone ahead of UTC.
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// The next `count` days starting today, as date keys — the mobile slot picker's date strip.
// A rolling short window rather than a full calendar widget: no new native dependency
// (@react-native-community/datetimepicker isn't installed), and most bookings in this kind of
// app happen within the next couple of weeks anyway.
export function upcomingDateKeys(count: number, from: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    return toDateKey(d);
  });
}

export function formatDateChipLabel(dateKey: string, locale: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  return date.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" });
}

export function formatTime(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}
