import { screen, userEvent } from "@testing-library/react-native";

import ConnectionCheckScreen from "../../app/debug-connection";
import { renderWithProviders } from "../utils/render";
import { getHealth } from "@/api/health";

jest.mock("@/api/health");
const mockGetHealth = jest.mocked(getHealth);

// `render` is asynchronous as of React Native Testing Library v14 — awaiting it is not optional
// tidiness. Without the await, `screen` is read before the render result is registered and every
// query fails with the misleading "`render` function has not been called".
describe("ConnectionCheckScreen", () => {
  beforeEach(() => mockGetHealth.mockReset());

  it("reports a reachable backend with a live database", async () => {
    mockGetHealth.mockResolvedValue({ status: "ok", dbConnected: true });

    await renderWithProviders(<ConnectionCheckScreen />);

    expect(await screen.findByText(/Backend reachable/)).toBeTruthy();
    expect(screen.getByText(/Database connected/)).toBeTruthy();
  });

  // A reachable API whose database is down is a genuinely different failure from an unreachable
  // API, and the screen exists to tell them apart — so it gets its own test.
  it("distinguishes a reachable backend with a dead database", async () => {
    mockGetHealth.mockResolvedValue({ status: "degraded", dbConnected: false });

    await renderWithProviders(<ConnectionCheckScreen />);

    expect(await screen.findByText(/Database NOT connected/)).toBeTruthy();
  });

  // The interesting half: the whole point of this screen is diagnosing a FAILED connection, so
  // the failure path is what actually has to work on a fresh emulator.
  it("surfaces the error message when the backend cannot be reached", async () => {
    mockGetHealth.mockRejectedValue(new Error("Network request failed"));

    await renderWithProviders(<ConnectionCheckScreen />);

    expect(await screen.findByText(/Could not reach the backend/)).toBeTruthy();
    expect(screen.getByText(/Network request failed/)).toBeTruthy();
  });

  it("refetches when 'Check again' is pressed", async () => {
    mockGetHealth.mockRejectedValueOnce(new Error("Network request failed"));
    mockGetHealth.mockResolvedValueOnce({ status: "ok", dbConnected: true });

    await renderWithProviders(<ConnectionCheckScreen />);
    await screen.findByText(/Could not reach the backend/);

    await userEvent.press(screen.getByRole("button", { name: "Check again" }));

    expect(await screen.findByText(/Backend reachable/)).toBeTruthy();
    expect(mockGetHealth).toHaveBeenCalledTimes(2);
  });
});
