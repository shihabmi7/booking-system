import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";

/**
 * Renders a screen inside the same providers app/_layout.tsx gives it in the real app.
 *
 * A FRESH QueryClient per call, not the app's shared one — a cached result leaking from one test
 * into the next is the classic React Query testing trap, and it fails in the worst way: the test
 * passes alone and fails in the suite. Retries are off for the same reason the app has them on:
 * here a failed query should surface immediately rather than be retried for a second first.
 */
export function renderWithProviders(ui: ReactElement) {
  const queryClient = new QueryClient({
    // gcTime: Infinity makes React Query skip scheduling its cache-eviction timer entirely. With
    // the default five-minute gcTime that timer is an open handle, and Jest hangs after the last
    // test with "did not exit one second after the test run has completed".
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
