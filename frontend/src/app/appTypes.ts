import type { ViewTab } from "../components/layout/ViewTabs";
import type { LocalSchedulePreferences } from "../data/localScheduleStorage";
import type { ScheduleWorkspace } from "../data/scheduleRepository";
import type { TaskHistory } from "../features/gantt/types/ganttState";
import type {
  ActivityLogEntry,
  GanttColumnVisibility,
  GanttScale,
  GanttTimeUnit,
  ResourceDisplaySettings,
  ResourceScope,
  ScheduleFilters,
} from "../types/schedule";

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

/** API送信状態を表示層へ渡すための状態モデルです。 */
export type ApiSyncState = {
  error: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  queuedChangeCount: number;
  status: "idle" | "failed" | "sending" | "synced";
};
