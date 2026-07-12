import { queryOptions } from "@tanstack/react-query";

import { apiScheduleRepository } from "../../../data/apiScheduleRepository";

export const projectQueryKeys = {
  all: ["projects"] as const,
  schedule: (projectId: string) => ["projects", "schedule", projectId] as const,
  schedules: ["projects", "schedule"] as const,
  workspaceSummary: ["projects", "workspace-summary"] as const,
};

/** 案件カードとチーム選択に必要な軽量サマリーを取得します。 */
export function workspaceSummaryQueryOptions() {
  return queryOptions({
    queryFn: () => apiScheduleRepository.getWorkspaceSummary(),
    queryKey: projectQueryKeys.workspaceSummary,
  });
}

/** 指定案件のスケジュール、添付、変更履歴を案件単位で取得します。 */
export function projectScheduleQueryOptions(projectId: string) {
  return queryOptions({
    queryFn: () => apiScheduleRepository.getProjectSchedule(projectId),
    queryKey: projectQueryKeys.schedule(projectId),
  });
}
