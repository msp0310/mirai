import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

import type { AuthUser } from "../data/authRepository";
import { loadLocalScheduleDraft } from "../data/localScheduleStorage";
import {
  projectQueryKeys,
  projectScheduleQueryOptions,
  workspaceSummaryQueryOptions,
} from "../features/projects/api/projectQueries";
import { createInitialAppState } from "./appState";
import type { AppInitialState } from "./appTypes";
import { createInitialScheduleWorkspace, selectInitialProject } from "./projectLoading";
import { getProjectIdFromCurrentRoute } from "./routing/miraiRouteState";

type AppBootstrapState =
  | { status: "idle" }
  | { status: "loading" }
  | { error: unknown; reload: () => Promise<void>; status: "failed" }
  | {
      initialAppState: AppInitialState;
      loadId: string;
      reload: () => Promise<void>;
      status: "ready";
    };

/** 軽量サマリーと選択案件だけを取得し、ワークベンチ初期状態へ変換します。 */
export function useAppBootstrap(currentUser: AuthUser | null): AppBootstrapState {
  const queryClient = useQueryClient();
  const [generation, setGeneration] = useState(0);
  const enabled = Boolean(currentUser && !currentUser.passwordResetRequired);
  const summaryQuery = useQuery({ ...workspaceSummaryQueryOptions(), enabled });
  const initialProject = useMemo(() => {
    if (!summaryQuery.data) {
      return undefined;
    }
    const draft = loadLocalScheduleDraft();
    return selectInitialProject(summaryQuery.data, {
      draftProjectId: draft?.activeProjectId,
      hashProjectId: getProjectIdFromCurrentRoute(),
    });
  }, [summaryQuery.data]);
  const scheduleQuery = useQuery({
    ...projectScheduleQueryOptions(initialProject?.id ?? ""),
    enabled: enabled && Boolean(initialProject),
  });
  const reload = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: projectQueryKeys.all });
    setGeneration((current) => current + 1);
  }, [queryClient]);
  const initialAppState = useMemo(() => {
    if (!summaryQuery.data || !scheduleQuery.data) {
      return null;
    }
    return createInitialAppState(
      createInitialScheduleWorkspace(summaryQuery.data, scheduleQuery.data),
    );
  }, [scheduleQuery.data, summaryQuery.data]);

  if (!enabled) {
    return { status: "idle" };
  }
  if (summaryQuery.error && !summaryQuery.data) {
    return { error: summaryQuery.error, reload, status: "failed" };
  }
  if (summaryQuery.data && !initialProject) {
    return {
      error: new Error("APIからプロジェクトが取得できませんでした。"),
      reload,
      status: "failed",
    };
  }
  if (scheduleQuery.error && !scheduleQuery.data) {
    return { error: scheduleQuery.error, reload, status: "failed" };
  }
  if (!initialAppState || !initialProject || !currentUser) {
    return { status: "loading" };
  }
  return {
    initialAppState,
    loadId: `${currentUser.id}:${initialProject.id}:${generation}`,
    reload,
    status: "ready",
  };
}
