import { screen } from "@testing-library/react-native";

import { EmptyState } from "@/components/EmptyState";
import { renderWithProviders } from "../utils/render";

describe("EmptyState", () => {
  it("renders the given message", async () => {
    await renderWithProviders(<EmptyState icon="calendar-blank-outline" message="No bookings yet." />);

    expect(screen.getByText("No bookings yet.")).toBeTruthy();
  });
});
