import type { ViewTab } from "../components/layout/ViewTabs";
import type { AuthUser } from "../data/authRepository";
import type { LocalSchedulePreferences } from "../data/localScheduleStorage";
import type { ScheduleWorkspace } from "../data/scheduleRepository";
import type {
  ActivityLogEntry,
  GanttColumnVisibility,
  GanttScale,
  GanttTimeUnit,
  ResourceDisplaySettings,
  ResourceScope,
  ScheduleFilters,
  ScheduleTask,
  TaskInspectorFocusTarget,
} from "../types/schedule";

/** 1プロジェクト分のタスクに対するUndo/Redo状態です。 */
export type TaskHistory = {
  future: ScheduleTask[][];
  past: ScheduleTask[][];
  present: ScheduleTask[];
};

/** ローカルに保存できるアプリケーション状態です。 */
export type PersistableDraft = LocalSchedulePreferences & {
  activityLogs: Record<string, ActivityLogEntry[]>;
  workspace: ScheduleWorkspace;
};

/** 認証後のワークベンチを表示するために正規化された初期状態です。 */
export type AppInitialState = {
  activeProjectId: string;
  activeTab: ViewTab;
  activeTeamId: string;
  activityLogs: Record<string, ActivityLogEntry[]>;
  calendarAware: boolean;
  columnVisibility: GanttColumnVisibility;
  collapsedIdsByProject: Record<string, string[]>;
  favoriteProjectIds: Set<string>;
  filterOpen: boolean;
  filters: ScheduleFilters;
  routeProjectId: string | null;
  routeProjectMatched: boolean;
  resourceDisplaySettings: ResourceDisplaySettings;
  resourceScope: ResourceScope;
  savedDraft: PersistableDraft;
  lastSavedAt: string | null;
  savedSignature: string;
  savedWorkspace: ScheduleWorkspace;
  scale: GanttScale;
  taskHistories: Record<string, TaskHistory>;
  timeUnit: GanttTimeUnit;
  workspace: ScheduleWorkspace;
};

/** 認証後のワークスペース初期取得状態です。 */
export type AppBootState =
  | { status: "loading" }
  | { error: string; status: "failed" }
  | { initialAppState: AppInitialState; loadId: number; status: "ready" };

/** アプリケーションシェルで使う認証状態です。 */
export type AuthState =
  | { status: "checking" }
  | { error: string | null; status: "signedOut" }
  | { status: "signedIn"; user: AuthUser };

/** タスクのコピー・貼り付け操作で使うクリップボード情報です。 */
export type TaskClipboard = {
  copiedAt: number;
  label: string;
  tasks: ScheduleTask[];
};

/** マウス操作とキーボード操作で共有する選択オプションです。 */
export type TaskSelectionOptions = {
  additive?: boolean;
  focusTarget?: TaskInspectorFocusTarget;
  range?: boolean;
};

/** フォーカス対象のタスクと詳細画面のセクションを識別します。 */
export type TaskFocusRequest = {
  requestId: number;
  target: TaskInspectorFocusTarget;
  taskId: string;
};

/** API送信状態を表示層へ渡すための状態モデルです。 */
export type ApiSyncState = {
  error: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  queuedChangeCount: number;
  status: "idle" | "failed" | "sending" | "synced";
};
