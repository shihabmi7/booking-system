import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement } from "react";
import { PaperProvider } from "react-native-paper";

import i18n, { initI18n } from "@/i18n";
import { buildTheme } from "@/theme";

/**
 * Renders a screen inside the same providers app/_layout.tsx gives it in the real app.
 *
 * i18n is initialised for real rather than stubbed with an identity `t` — a stub would let a typo'd
 * or missing translation key pass every test and only show up on a device. The language is reset to
 * English each time because i18next is a singleton: without the reset, a test that switches to
 * Bangla would leave every later test in this file running in Bangla.
 *
 * The QueryClient is FRESH per call, not the app's shared one — a cached result leaking from one
 * test into the next is the classic React Query testing trap, and it fails in the worst way: the
 * test passes alone and fails in the suite. Retries are off for the same reason the app has them
 * on: here a failed query should surface immediately rather than be retried for a second first.
 */
export async function renderWithProviders(ui: ReactElement) {
  await initI18n();
  await i18n.changeLanguage("en");

  const queryClient = new QueryClient({
    // gcTime: Infinity makes React Query skip scheduling its cache-eviction timer entirely. With
    // the default five-minute gcTime that timer is an open handle, and Jest hangs after the last
    // test with "did not exit one second after the test run has completed".
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PaperProvider theme={buildTheme("light", "en")}>{ui}</PaperProvider>
    </QueryClientProvider>,
  );
}
