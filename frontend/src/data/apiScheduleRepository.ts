import type { ScheduleChangeLog } from "../types/schedule";
import { requestJson } from "./apiClient";
import { getProjectAttachments } from "./attachmentRepository";
import { authRepository } from "./authRepository";
import type {
  ProjectSummary,
  ScheduleRepository,
  ScheduleRepositorySaveOptions,
  ScheduleRepositorySaveResult,
  ScheduleRepositorySyncStatus,
  ScheduleSnapshot,
  ScheduleWorkspace,
  ScheduleWorkspaceSummary,
} from "./scheduleRepository";
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

  /** 案件一覧向けに、詳細タスクを除いた初期データを取得します。 */
  async getWorkspaceSummary() {
    return requestAuthenticatedJson<ScheduleWorkspaceSummary>("/workspace/summary");
  },

  /** 指定案件の詳細スケジュールを取得します。 */
  async getProjectSchedule(projectId) {
    const [schedule, attachments, changeLogs] = await Promise.all([
      requestAuthenticatedJson<ScheduleSnapshot>(
        `/projects/${encodeURIComponent(projectId)}/schedule`,
      ),
      getProjectAttachments(projectId),
      requestAuthenticatedJson<ScheduleChangeLog[]>(
        `/projects/${encodeURIComponent(projectId)}/changes`,
      ),
    ]);
    return { ...schedule, attachments, changeLogs };
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

  async createProject(schedule) {
    await requestAuthenticatedJson(`/projects`, {
      body: JSON.stringify({
        calendar: schedule.calendar,
        changeReason: "新規作成",
        expectedVersion: null,
        issues: schedule.issues ?? [],
        members: schedule.members,
        project: schedule.project,
        tasks: schedule.tasks,
        workLogs: schedule.workLogs ?? [],
      }),
      method: "POST",
    });
    return this.getProjectSchedule(schedule.project.id);
  },

  async saveTeam(team) {
    return requestAuthenticatedJson(`/admin/teams/${encodeURIComponent(team.id)}`, {
      body: JSON.stringify(team),
      method: "PUT",
    });
  },

  async saveMember(member) {
    return requestAuthenticatedJson(`/admin/members/${encodeURIComponent(member.id)}`, {
      body: JSON.stringify(member),
      method: "PUT",
    });
  },

  async saveTeamCalendar(teamId, calendar) {
    return requestAuthenticatedJson(`/admin/teams/${encodeURIComponent(teamId)}/calendar`, {
      body: JSON.stringify(calendar),
      method: "PUT",
    });
  },

  async updateTaskActual(projectId, taskId, actual, expectedProjectVersion) {
    return requestAuthenticatedJson(
      `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/actual`,
      {
        body: JSON.stringify({
          actualEnd: actual.actualEnd ?? null,
          actualStart: actual.actualStart ?? null,
          expectedProjectVersion: expectedProjectVersion ?? null,
          progress: actual.progress,
          status: actual.status,
        }),
        method: "PATCH",
      },
    );
  },

  /** 選択案件の内容だけをプロジェクト単位で保存します。 */
  async saveWorkspace(
    workspace: ScheduleWorkspace,
    options: ScheduleRepositorySaveOptions,
    previousWorkspace?: ScheduleWorkspace,
  ): Promise<ScheduleRepositorySaveResult> {
    const schedule = workspace.schedules.find(
      (snapshot) => snapshot.project.id === options.activeProjectId,
    );
    if (!schedule) {
      throw new Error(`保存対象のプロジェクトが見つかりません: ${options.activeProjectId}`);
    }

    const previousSchedule = previousWorkspace?.schedules.find(
      (snapshot) => snapshot.project.id === options.activeProjectId,
    );
    const taskPlanChanged =
      previousSchedule != null && !hasSameValue(schedule.tasks, previousSchedule.tasks);
    const projectDataChanged =
      previousSchedule != null && !hasSameProjectData(schedule, previousSchedule);

    if (previousSchedule && !taskPlanChanged && !projectDataChanged) {
      return {
        mode: "remote",
        revision: `project-${schedule.project.id}-v${schedule.project.version ?? 0}`,
        savedAt: new Date().toISOString(),
        workspace,
      };
    }

    const useTaskPlanBoundary =
      previousSchedule != null &&
      taskPlanChanged &&
      !projectDataChanged &&
      (schedule.access?.canEditPlan ?? true);

    const result = await requestAuthenticatedJson<SaveScheduleResponse>(
      `/projects/${encodeURIComponent(options.activeProjectId)}/${useTaskPlanBoundary ? "tasks" : "schedule"}`,
      {
        body: JSON.stringify(
          useTaskPlanBoundary
            ? {
                changeReason: options.changeReason?.trim() || null,
                expectedVersion: schedule.project.version ?? null,
                tasks: schedule.tasks,
              }
            : {
                calendar: schedule.calendar,
                changeReason: options.changeReason?.trim() || null,
                expectedVersion: schedule.project.version ?? null,
                issues: schedule.issues ?? [],
                members: schedule.members,
                project: schedule.project,
                tasks: schedule.tasks,
                workLogs: schedule.workLogs ?? [],
              },
        ),
        method: "PUT",
      },
    );
    const changeLogs = await requestAuthenticatedJson<ScheduleChangeLog[]>(
      `/projects/${encodeURIComponent(options.activeProjectId)}/changes`,
    );

    return {
      mode: "remote",
      revision: result.revision,
      savedAt: result.savedAt,
      workspace: {
        ...workspace,
        schedules: workspace.schedules.map((snapshot) =>
          snapshot.project.id === result.schedule.project.id
            ? {
                ...result.schedule,
                attachments: schedule.attachments,
                changeLogs,
              }
            : snapshot,
        ),
      },
    };
  },
};

function hasSameProjectData(left: ScheduleSnapshot, right: ScheduleSnapshot) {
  const { version: _leftVersion, ...leftProject } = left.project;
  const { version: _rightVersion, ...rightProject } = right.project;
  return hasSameValue(
    {
      calendar: left.calendar,
      issues: left.issues ?? [],
      members: left.members,
      project: leftProject,
      workLogs: left.workLogs ?? [],
    },
    {
      calendar: right.calendar,
      issues: right.issues ?? [],
      members: right.members,
      project: rightProject,
      workLogs: right.workLogs ?? [],
    },
  );
}

function hasSameValue(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
