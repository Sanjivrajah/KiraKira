import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Browser-local records can change through any workspace route. Treat
        // cached data as immediately stale so a screen remount always reads
        // the latest records instead of requiring a full browser reload.
        staleTime: 0,
        retry: 1,
        retryDelay: 0,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function clearQueryCache(queryClient: QueryClient) {
  queryClient.clear();
}
