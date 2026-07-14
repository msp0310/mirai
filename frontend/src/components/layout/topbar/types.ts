import type { Project, Team } from "../../../types/schedule";

export type ExportFormat = "csv" | "json";

export type TopbarNotification = {
  detail: string;
  id: string;
  title: string;
  tone: "info" | "warning" | "danger";
};

export type TopbarSyncStatus = {
  detail: string;
  endpointLabel: string;
  lastSyncedAt: string | null;
  modeLabel: string;
  pendingChangeCount: number;
  providerLabel: string;
  scopeLabel: string;
  status: "dirty" | "error" | "saving" | "synced";
  title: string;
};

export type TopbarContextMode =
  | "admin"
  | "dailyReports"
  | "personalAnalytics"
  | "help"
  | "portfolio"
  | "project"
  | "workload";

export type TopbarAuthUser = {
  email: string;
  name: string;
  role: string;
};

export type TopbarSyncQueueItem = {
  detail: string;
  id: string;
  status: "failed" | "pending" | "sending" | "synced";
  title: string;
  updatedAt?: string | null;
};

export type TopbarMenu = "account" | "notifications" | "projects" | "sync";

export type TopbarProps = {
  activeTeamId: string;
  allProjects: Project[];
  contextMode: TopbarContextMode;
  currentUser: TopbarAuthUser;
  favorite: boolean;
  favoriteProjectIds: Set<string>;
  hasUnsavedChanges: boolean;
  notifications: TopbarNotification[];
  onFavoriteToggle: () => void;
  onLogout: () => Promise<void>;
  onRetryApiSync: () => void;
  onProjectChange: (projectId: string) => void;
  onProjectRestore: (projectId: string) => void;
  onResetDraft: () => void;
  onSaveDraft: () => void;
  onTeamChange: (teamId: string) => void;
  project: Project;
  projects: Project[];
  syncQueueItems: TopbarSyncQueueItem[];
  syncStatus: TopbarSyncStatus;
  teams: Team[];
};
