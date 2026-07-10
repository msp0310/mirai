import type {
  ScheduleRepository,
  ScheduleRepositorySaveOptions,
  ScheduleRepositorySaveResult,
  ScheduleRepositorySyncStatus,
  ScheduleSnapshot,
  ScheduleWorkspace,
  ScheduleWorkspaceSummary,
  ProjectSummary,
} from "./scheduleRepository";
import { authRepository } from "./authRepository";
import { requestJson } from "./apiClient";
export { ApiRequestError } from "./apiClient";

type SaveScheduleResponse = {
  mode: "remote";
  revision: string;
  savedAt: string;
  schedule: ScheduleSnapshot;
};

const apiBaseUrl = (import.meta.env.VITE_SCHEDULE_API_BASE_URL ?? "/api").replace(/\/$/, "");

/** 認証ヘッダーを付与してAPI JSONを取得します。 */
async function requestAuthenticatedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const accessToken = authRepository.getAccessToken();
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return requestJson<T>(path, { ...init, headers });
}

export const apiScheduleRepository: ScheduleRepository = {
  /** 案件一覧用の軽量集計だけを取得します。 */
  async getProjectSummaries() {
    return requestAuthenticatedJson<ProjectSummary[]>("/projects/summary");
  },

  /** 既存互換用に全ワークスペースを取得します。詳細画面では遅延取得を優先します。 */
  async getWorkspace() {
    return requestAuthenticatedJson<ScheduleWorkspace>("/workspace");
  },

  /** 案件一覧向けに、詳細タスクを除いた初期データを取得します。 */
  async getWorkspaceSummary() {
    return requestAuthenticatedJson<ScheduleWorkspaceSummary>("/workspace/summary");
  },

  /** 指定案件の詳細スケジュールを取得します。 */
  async getProjectSchedule(projectId) {
    return requestAuthenticatedJson<ScheduleSnapshot>(
      `/projects/${encodeURIComponent(projectId)}/schedule`,
    );
  },

  /** APIのヘルスチェックを行い、同期表示用の状態を返します。 */
  async getSyncStatus(): Promise<ScheduleRepositorySyncStatus> {
    await requestAuthenticatedJson("/health");
    return {
      connected: true,
      endpointLabel: apiBaseUrl,
      lastSyncedAt: new Date().toISOString(),
      mode: "remote",
      pendingChangeCount: 0,
      providerLabel: "ASP.NET Core + SQLite",
    };
  },

  /** 選択案件の内容だけをプロジェクト単位で保存します。 */
  async saveWorkspace(
    workspace: ScheduleWorkspace,
    options: ScheduleRepositorySaveOptions,
  ): Promise<ScheduleRepositorySaveResult> {
    const schedule = workspace.schedules.find(
      (snapshot) => snapshot.project.id === options.activeProjectId,
    );
    if (!schedule) {
      throw new Error(`保存対象のプロジェクトが見つかりません: ${options.activeProjectId}`);
    }

    const result = await requestAuthenticatedJson<SaveScheduleResponse>(
      `/projects/${encodeURIComponent(options.activeProjectId)}/schedule`,
      {
        body: JSON.stringify({
          calendar: schedule.calendar,
          expectedVersion: schedule.project.version ?? null,
          issues: schedule.issues ?? [],
          members: schedule.members,
          project: schedule.project,
          tasks: schedule.tasks,
          workLogs: schedule.workLogs ?? [],
        }),
        method: "PUT",
      },
    );

    return {
      mode: "remote",
      revision: result.revision,
      savedAt: result.savedAt,
      workspace: {
        ...workspace,
        schedules: workspace.schedules.map((snapshot) =>
          snapshot.project.id === result.schedule.project.id ? result.schedule : snapshot,
        ),
      },
    };
  },
};
