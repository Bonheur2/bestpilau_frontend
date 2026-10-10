import { QueryClient } from '@tanstack/react-query';

// Everything fetched through useApi lives here, so going back to a screen shows what it showed before
// while a fresh copy loads in the background.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Always refetch when a screen opens (the old data shows meanwhile); identical requests are shared
      staleTime: 0,
      // Keep screens you have left for 10 minutes
      gcTime: 10 * 60_000,
      // Errors surface in the UI; retrying a 401/403/400 only slows it down
      retry: false,
      refetchOnWindowFocus: true,
    },
  },
});
