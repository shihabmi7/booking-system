import { QueryClient } from "@tanstack/react-query";

/**
 * One client for the whole app, created at module scope rather than inside a component so a
 * re-render of the root layout can never throw the cache away.
 *
 * Query hooks rather than hand-rolled useEffect + useState is a deliberate call, and not only for
 * tidiness: React's `set-state-in-effect` lint rule rejects the useEffect version outright, because
 * a fetch kicked off in an effect body and written back with setState is exactly the cascading
 * render pattern React Query exists to replace. Retries, loading/error state and refetching all
 * come free, which is what every screen from Phase 2 on will need.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A phone loses connectivity constantly — one retry is worth having, but the default of
      // three turns a genuinely-down backend into a ~10s wait before the error is shown.
      retry: 1,
      staleTime: 30_000,
    },
  },
});
