import AsyncStorage from "@react-native-async-storage/async-storage";
import { dehydrate, hydrate, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useEffect, useState } from "react";

const QUERY_CACHE_KEY = "provision_query_cache_v1";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
  },
});

export function OfflineQueryProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let persistTimer: ReturnType<typeof setTimeout> | undefined;

    const persist = () => {
      if (persistTimer) clearTimeout(persistTimer);
      persistTimer = setTimeout(() => {
        AsyncStorage.setItem(QUERY_CACHE_KEY, JSON.stringify(dehydrate(queryClient))).catch(() => {});
      }, 250);
    };

    const restore = async () => {
      try {
        const cached = await AsyncStorage.getItem(QUERY_CACHE_KEY);
        if (cached) hydrate(queryClient, JSON.parse(cached));
      } catch {
        await AsyncStorage.removeItem(QUERY_CACHE_KEY).catch(() => {});
      } finally {
        if (active) setReady(true);
      }
    };

    void restore();
    const unsubscribe = queryClient.getQueryCache().subscribe(persist);
    return () => {
      active = false;
      unsubscribe();
      if (persistTimer) clearTimeout(persistTimer);
    };
  }, []);

  if (!ready) return null;
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
