import type {
  Attachment,
  CalendarDefinition,
  Member,
  Project,
  ProjectAccess,
  ProjectIssue,
  ProjectWorkLog,
  ScheduleChangeLog,
  ScheduleTask,
  Team,
} from "../types/schedule";

export type ScheduleSnapshot = {
  access?: ProjectAccess;
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
  access?: ProjectAccess;
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
  changeReason?: string;
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
  /** 初期表示用のチームと案件集計を取得します。 */
  getWorkspaceSummary(): Promise<ScheduleWorkspaceSummary>;
  /** 指定案件のタスク・カレンダー・メンバー詳細を取得します。 */
  getProjectSchedule(projectId: string): Promise<ScheduleSnapshot>;
  /** API接続状態を取得します。 */
  getSyncStatus(): Promise<ScheduleRepositorySyncStatus>;
  /** 新規案件をAPIへ作成します。 */
  createProject(schedule: ScheduleSnapshot): Promise<ScheduleSnapshot>;
  /** チームマスターを保存します。 */
  saveTeam(team: Team): Promise<Team>;
  /** メンバーマスターを保存します。 */
  saveMember(member: Member): Promise<Member>;
  /** チーム配下案件へ標準カレンダーを一括保存します。 */
  saveTeamCalendar(teamId: string, calendar: CalendarDefinition): Promise<CalendarDefinition>;
  /** 計画を変更せずタスク実績だけを保存します。 */
  updateTaskActual(
    projectId: string,
    taskId: string,
    actual: Pick<ScheduleTask, "status" | "progress" | "actualStart" | "actualEnd">,
    expectedProjectVersion?: number,
  ): Promise<ScheduleSnapshot>;
  /** 指定案件の変更を保存します。 */
  saveWorkspace(
    workspace: ScheduleWorkspace,
    options: ScheduleRepositorySaveOptions,
    previousWorkspace?: ScheduleWorkspace,
  ): Promise<ScheduleRepositorySaveResult>;
};
