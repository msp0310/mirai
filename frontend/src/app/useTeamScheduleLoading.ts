import { useQueryClient } from "@tanstack/react-query";
import { type Dispatch, type SetStateAction, useEffect, useState } from "react";

import type { ViewTab } from "../components/layout/ViewTabs";
import type { ProjectSummary, ScheduleWorkspace } from "../data/scheduleRepository";
import { projectScheduleQueryOptions } from "../features/projects/api/projectQueries";
import { mergeScheduleIntoWorkspace } from "../lib/scheduleWorkspace";
import type { ResourceScope } from "../types/schedule";
import { findMissingProjectIds } from "./projectLoading";

type UseTeamScheduleLoadingOptions = {
  activeTab: ViewTab;
  activeTeamId: string;
  onError: (message: string) => void;
  onLoaded: (schedules: ScheduleWorkspace["schedules"]) => void;
  projectSummaries: ProjectSummary[];
  resourceScope: ResourceScope;
  setWorkspace: Dispatch<SetStateAction<ScheduleWorkspace>>;
  workspace: ScheduleWorkspace;
};

/** 横断画面で必要になった案件詳細だけを遅延取得します。 */
export function useTeamScheduleLoading({
  activeTab,
  activeTeamId,
  onError,
  onLoaded,
  projectSummaries,
  resourceScope,
  setWorkspace,
  workspace,
}: UseTeamScheduleLoadingOptions) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadsAllTeams =
      activeTab === "Workload" || activeTab === "DailyReports" || activeTab === "PersonalAnalytics";
    if (resourceScope !== "team" && !loadsAllTeams) {
      return;
    }

    const targetTeamIds = loadsAllTeams
      ? workspace.teams.map((team) => team.id)
      : [activeTeamId || null];
    const missingProjectIds = [
      ...new Set(
        targetTeamIds.flatMap((teamId) =>
          findMissingProjectIds(projectSummaries, workspace.schedules, teamId),
        ),
      ),
    ];
    if (missingProjectIds.length === 0) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    Promise.all(
      missingProjectIds.map((projectId) =>
        queryClient.fetchQuery(projectScheduleQueryOptions(projectId)),
      ),
    )
      .then((schedules) => {
        if (!cancelled) {
          setWorkspace((current) => schedules.reduce(mergeScheduleIntoWorkspace, current));
          onLoaded(schedules);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onError(error instanceof Error ? error.message : "チーム案件を取得できませんでした。");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    activeTeamId,
    onError,
    onLoaded,
    projectSummaries,
    queryClient,
    resourceScope,
    setWorkspace,
    workspace.schedules,
    workspace.teams,
  ]);

  return loading;
}
