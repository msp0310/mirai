import type {
  CalendarDefinition,
  Attachment,
  Member,
  Project,
  ProjectIssue,
  ProjectWorkLog,
  ScheduleChangeLog,
  ScheduleTask,
  Team,
} from "../types/schedule";

export type ScheduleSnapshot = {
  attachments?: Attachment[];
  calendar: CalendarDefinition;
  changeLogs?: ScheduleChangeLog[];
  issues?: ProjectIssue[];
  members: Member[];
  project: Project;
  tasks: ScheduleTask[];
  workLogs?: ProjectWorkLog[];
};

/** 案件一覧で使う、タスク明細を含まない軽量な集計です。 */
export type ProjectSummary = {
  completedTaskCount: number;
  delayedTaskCount: number;
  memberCount: number;
  progress: number;
  project: Project;
  taskCount: number;
};

export type ScheduleWorkspace = {
  projectSummaries?: ProjectSummary[];
  schedules: ScheduleSnapshot[];
  teams: Team[];
};

/** 案件一覧の初期表示に使う、詳細タスクを含まないワークスペース情報です。 */
export type ScheduleWorkspaceSummary = {
  projects: ProjectSummary[];
  teams: Team[];
};

export type ScheduleRepositoryMode = "local" | "remote";

export type ScheduleRepositorySaveReason = "manual" | "autosave" | "import" | "project-settings";

export type ScheduleRepositorySaveOptions = {
  activeProjectId: string;
  activeTeamId: string;
  reason: ScheduleRepositorySaveReason;
};

export type ScheduleRepositorySaveResult = {
  mode: ScheduleRepositoryMode;
  revision: string;
  savedAt: string;
  workspace: ScheduleWorkspace;
};

export type ScheduleRepositorySyncStatus = {
  connected: boolean;
  endpointLabel: string;
  lastSyncedAt: string | null;
  mode: ScheduleRepositoryMode;
  pendingChangeCount: number;
  providerLabel: string;
};

export type ScheduleRepository = {
  /** 案件一覧用の軽量集計を取得します。 */
  getProjectSummaries(): Promise<ProjectSummary[]>;
  /** 互換用の全件ワークスペースを取得します。 */
  getWorkspace(): Promise<ScheduleWorkspace>;
  /** 初期表示用のチームと案件集計を取得します。 */
  getWorkspaceSummary(): Promise<ScheduleWorkspaceSummary>;
  /** 指定案件のタスク・カレンダー・メンバー詳細を取得します。 */
  getProjectSchedule(projectId: string): Promise<ScheduleSnapshot>;
  /** API接続状態を取得します。 */
  getSyncStatus(): Promise<ScheduleRepositorySyncStatus>;
  /** 指定案件の変更を保存します。 */
  saveWorkspace(
    workspace: ScheduleWorkspace,
    options: ScheduleRepositorySaveOptions,
  ): Promise<ScheduleRepositorySaveResult>;
};
