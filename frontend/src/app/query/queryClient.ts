import { QueryClient } from "@tanstack/react-query";

import { ApiRequestError } from "../../data/apiClient";

/**
 * サーバー状態だけを保持するQueryClientです。
 * 編集中のガントや表示設定はReact state/Jotai側で管理します。
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false,
    },
    queries: {
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (error instanceof ApiRequestError && [401, 403, 404].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
  },
});
