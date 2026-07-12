import { queryOptions } from "@tanstack/react-query";

import { authRepository } from "../../../data/authRepository";

export const authQueryKeys = {
  all: ["auth"] as const,
  currentUser: ["auth", "current-user"] as const,
};

/** 現在のCookieセッションに対応する利用者を取得します。 */
export function currentUserQueryOptions() {
  return queryOptions({
    queryFn: () => authRepository.getCurrentUser(),
    queryKey: authQueryKeys.currentUser,
    staleTime: 60_000,
  });
}
