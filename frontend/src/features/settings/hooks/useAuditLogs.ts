import { useQuery } from "@tanstack/react-query";

import { listAuditLogs } from "../../../data/administrationRepository";

/** 監査ログは監査タブが表示された時だけ遅延取得します。 */
export function useAuditLogs(active: boolean) {
  const query = useQuery({
    enabled: active,
    queryFn: () => listAuditLogs(),
    queryKey: ["administration", "audit-logs"],
  });
  return {
    auditLogs: query.data ?? [],
    loading: query.isPending && query.fetchStatus === "fetching",
  };
}
