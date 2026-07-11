import {
  ArrowDownTrayIcon,
  ArrowRightOnRectangleIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  BellIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  ShareIcon,
  StarIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Project, Team } from "../../types/schedule";

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

export type ApiConnectionMode = "offline" | "online";
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

type TopbarProps = {
  activeTeamId: string;
  allProjects: Project[];
  apiConnectionMode: ApiConnectionMode;
  contextMode: TopbarContextMode;
  currentUser: TopbarAuthUser;
  favorite: boolean;
  favoriteProjectIds: Set<string>;
  hasUnsavedChanges: boolean;
  notifications: TopbarNotification[];
  onApiConnectionModeChange: (mode: ApiConnectionMode) => void;
  onExportProject: (format: ExportFormat) => void;
  onImportBrabioXlsx: (file: File) => void;
  onFavoriteToggle: () => void;
  onImportProject: (file: File) => void;
  onImportTaskCsv: (file: File) => void;
  onLogout: () => Promise<void>;
  onRetryApiSync: () => void;
  onProjectLinkCopy: (copied: boolean) => void;
  onProjectChange: (projectId: string) => void;
  onProjectRestore: (projectId: string) => void;
  onProjectSettingsOpen: () => void;
  onResetDraft: () => void;
  onSaveDraft: () => void;
  onTeamChange: (teamId: string) => void;
  project: Project;
  projectSettingsOpen: boolean;
  projects: Project[];
  syncQueueItems: TopbarSyncQueueItem[];
  syncStatus: TopbarSyncStatus;
  teams: Team[];
};

/** 現在のチーム・案件、保存状態、プロジェクト操作を表示する共通ヘッダーです。 */
export function Topbar({
  activeTeamId,
  allProjects,
  apiConnectionMode,
  contextMode,
  currentUser,
  favorite,
  favoriteProjectIds,
  hasUnsavedChanges,
  notifications,
  onApiConnectionModeChange,
  onExportProject,
  onImportBrabioXlsx,
  onFavoriteToggle,
  onImportProject,
  onImportTaskCsv,
  onLogout,
  onRetryApiSync,
  onProjectLinkCopy,
  onProjectChange,
  onProjectRestore,
  onProjectSettingsOpen,
  onResetDraft,
  onSaveDraft,
  onTeamChange,
  project,
  projectSettingsOpen,
  projects,
  syncQueueItems,
  syncStatus,
  teams,
}: TopbarProps) {
  const [openMenu, setOpenMenu] = useState<
    "account" | "projects" | "share" | "export" | "notifications" | "sync" | null
  >(null);
  const [projectQuery, setProjectQuery] = useState("");
  const [shareCopyStatus, setShareCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const brabioImportInputRef = useRef<HTMLInputElement>(null);
  const csvImportInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);
  const projectSwitcherTriggerRef = useRef<HTMLButtonElement>(null);
  const projectRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const isAdminContext = contextMode === "admin";
  const isHelpContext = contextMode === "help";
  const isPortfolioContext = contextMode === "portfolio";
  const isWorkloadContext = contextMode === "workload";
  const isDailyReportsContext = contextMode === "dailyReports";
  const isPersonalAnalyticsContext = contextMode === "personalAnalytics";
  const isProjectContext = contextMode === "project";
  const pageTitle = isAdminContext
    ? "管理設定"
    : isHelpContext
      ? "ヘルプ"
      : isPortfolioContext
        ? "プロジェクトポートフォリオ"
        : isDailyReportsContext
          ? "日報"
          : isPersonalAnalyticsContext
            ? "マイ分析"
            : isWorkloadContext
              ? "稼働・要員計画"
              : project.workspace;
  const contextLabel = isAdminContext
    ? "管理設定"
    : isHelpContext
      ? "ヘルプ"
      : isDailyReportsContext
        ? "日報"
        : isPersonalAnalyticsContext
          ? "マイ分析"
          : isWorkloadContext
            ? "稼働・要員計画"
            : "案件一覧";
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const normalizedProjectQuery = projectQuery.trim().toLowerCase();
  const filteredProjects = useMemo(
    () =>
      allProjects.filter((item) => {
        if (!normalizedProjectQuery) return true;
        const team = teamById.get(item.teamId);
        return [item.workspace, item.name, item.id, team?.name ?? "", team?.code ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(normalizedProjectQuery);
      }),
    [allProjects, normalizedProjectQuery, teamById],
  );
  const projectSwitcherItems = useMemo(() => {
    const activeProjects = filteredProjects.filter((item) => item.status !== "archived");
    const archivedProjects = filteredProjects.filter((item) => item.status === "archived");
    const favoriteProjects = activeProjects.filter((item) => favoriteProjectIds.has(item.id));
    const regularProjects = activeProjects.filter((item) => !favoriteProjectIds.has(item.id));
    return [...favoriteProjects, ...regularProjects, ...archivedProjects];
  }, [favoriteProjectIds, filteredProjects]);
  const projectUrl =
    typeof window === "undefined"
      ? project.id
      : `${window.location.origin}${window.location.pathname}#${encodeURIComponent(project.id)}`;

  useEffect(() => {
    function handleGlobalProjectSearch(event: globalThis.KeyboardEvent) {
      if (isAdminContext || isHelpContext) return;
      const commandKey = event.metaKey || event.ctrlKey;
      if (
        event.defaultPrevented ||
        !commandKey ||
        event.altKey ||
        event.shiftKey ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }
      event.preventDefault();
      setProjectQuery("");
      setShareCopyStatus("idle");
      setOpenMenu("projects");
    }

    window.addEventListener("keydown", handleGlobalProjectSearch);
    return () => {
      window.removeEventListener("keydown", handleGlobalProjectSearch);
    };
  }, [isAdminContext, isHelpContext]);

  useEffect(() => {
    if ((isAdminContext || isHelpContext) && openMenu === "projects") {
      setOpenMenu(null);
      return;
    }
    if (!isProjectContext && (openMenu === "share" || openMenu === "export")) {
      setOpenMenu(null);
    }
  }, [isAdminContext, isHelpContext, isProjectContext, openMenu]);

  useEffect(() => {
    if (openMenu === null) return;

    function closeMenuOnOutsideClick(event: PointerEvent) {
      if (event.target instanceof Node && !topbarRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    }

    function closeMenuOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }

    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    window.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
      window.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [openMenu]);

  useEffect(() => {
    if (openMenu !== "projects") return;
    const frameId = window.requestAnimationFrame(() => {
      projectSearchInputRef.current?.focus();
      projectSearchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [openMenu]);

  function toggleMenu(
    menu: "account" | "projects" | "share" | "export" | "notifications" | "sync",
  ) {
    if (menu === "projects" && openMenu !== "projects") {
      setProjectQuery("");
    }
    setOpenMenu((current) => (current === menu ? null : menu));
    setShareCopyStatus("idle");
  }

  function closeProjectSwitcher() {
    setOpenMenu(null);
    setProjectQuery("");
    window.requestAnimationFrame(() => {
      projectSwitcherTriggerRef.current?.focus();
    });
  }

  function focusProjectSwitcherRow(index: number) {
    const item = projectSwitcherItems[index];
    if (!item) return;
    projectRowRefs.current.get(item.id)?.focus();
  }

  function handleProjectSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusProjectSwitcherRow(0);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeProjectSwitcher();
    }
  }

  function handleProjectRowKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusProjectSwitcherRow(Math.min(index + 1, projectSwitcherItems.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) {
        projectSearchInputRef.current?.focus();
        projectSearchInputRef.current?.select();
      } else {
        focusProjectSwitcherRow(index - 1);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeProjectSwitcher();
    }
  }

  function selectProject(item: Project) {
    if (item.status === "archived") {
      onProjectRestore(item.id);
    } else {
      onProjectChange(item.id);
    }
    setOpenMenu(null);
    setProjectQuery("");
  }

  async function copyProjectLink() {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(projectUrl);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = projectUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      copied = document.execCommand("copy");
      textarea.remove();
    }
    setShareCopyStatus(copied ? "copied" : "failed");
    onProjectLinkCopy(copied);
  }

  function exportProject(format: ExportFormat) {
    onExportProject(format);
    setOpenMenu(null);
  }

  function importProject(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    onImportProject(file);
    setOpenMenu(null);
  }

  function importTaskCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    onImportTaskCsv(file);
    setOpenMenu(null);
  }

  function importBrabioXlsx(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    onImportBrabioXlsx(file);
    setOpenMenu(null);
  }

  return (
    <header className="topbar" ref={topbarRef}>
      <div className="title-block">
        <div className="workspace-title">
          <div className="title-stack">
            <div className="context-picker" aria-label="作業対象">
              <select
                aria-label="チーム"
                onChange={(event) => {
                  setOpenMenu(null);
                  onTeamChange(event.target.value);
                }}
                value={activeTeamId}
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <ChevronRightIcon />
              {isProjectContext ? (
                <select
                  aria-label="プロジェクト"
                  onChange={(event) => {
                    setOpenMenu(null);
                    onProjectChange(event.target.value);
                  }}
                  value={project.id}
                >
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.workspace}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="context-chip">{contextLabel}</span>
              )}
              {!isAdminContext && !isHelpContext ? (
                <div className="project-switcher-wrap">
                  <button
                    aria-expanded={openMenu === "projects"}
                    aria-haspopup="dialog"
                    aria-label="プロジェクトを検索"
                    className={
                      openMenu === "projects"
                        ? "project-switcher-trigger active"
                        : "project-switcher-trigger"
                    }
                    onClick={() => toggleMenu("projects")}
                    ref={projectSwitcherTriggerRef}
                    title="プロジェクトを検索"
                    type="button"
                  >
                    <MagnifyingGlassIcon />
                  </button>
                  {openMenu === "projects" ? (
                    <div
                      aria-label="プロジェクト切替"
                      className="topbar-popover project-switcher-popover"
                      role="dialog"
                    >
                      <div className="project-switcher-heading">
                        <strong>プロジェクト切替</strong>
                        <span>Ctrl/Cmd + K</span>
                      </div>
                      <input
                        aria-label="プロジェクト検索"
                        className="project-switcher-search"
                        onChange={(event) => setProjectQuery(event.target.value)}
                        onKeyDown={handleProjectSearchKeyDown}
                        placeholder="プロジェクト・チームで検索"
                        ref={projectSearchInputRef}
                        value={projectQuery}
                      />
                      <div className="project-switcher-list">
                        {projectSwitcherItems.map((item, index) => {
                          const team = teamById.get(item.teamId);
                          const isActiveProject = item.id === project.id;
                          const isFavoriteProject = favoriteProjectIds.has(item.id);
                          const isArchivedProject = item.status === "archived";
                          return (
                            <button
                              className={
                                isArchivedProject
                                  ? "project-switcher-row archived"
                                  : isActiveProject
                                    ? "project-switcher-row active"
                                    : "project-switcher-row"
                              }
                              key={item.id}
                              onClick={() => selectProject(item)}
                              onKeyDown={(event) => handleProjectRowKeyDown(event, index)}
                              ref={(node) => {
                                if (node) {
                                  projectRowRefs.current.set(item.id, node);
                                } else {
                                  projectRowRefs.current.delete(item.id);
                                }
                              }}
                              type="button"
                            >
                              <div>
                                <strong>{item.workspace}</strong>
                                <span>
                                  {team?.name ?? item.teamId} / {item.name}
                                </span>
                              </div>
                              {isArchivedProject ? (
                                <span className="project-switcher-status">復元</span>
                              ) : isFavoriteProject ? (
                                <StarIcon />
                              ) : null}
                            </button>
                          );
                        })}
                        {projectSwitcherItems.length === 0 ? (
                          <div className="project-switcher-empty">
                            該当するプロジェクトはありません
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="project-title-row">
              <h1>{pageTitle}</h1>
              {isProjectContext ? (
                <button
                  className={favorite ? "ghost-icon favorite active" : "ghost-icon favorite"}
                  aria-label="お気に入り"
                  onClick={onFavoriteToggle}
                  title={favorite ? "お気に入りから外す" : "お気に入りに追加"}
                  type="button"
                >
                  <StarIcon />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="topbar-actions">
        {!isDailyReportsContext && !isPersonalAnalyticsContext ? (
          <div className="topbar-action-wrap">
            <button
              className={`save-state ${syncStatus.status}${openMenu === "sync" ? " active" : ""}`}
              onClick={() => toggleMenu("sync")}
              title={syncStatus.detail}
              type="button"
            >
              <span />
              <div>
                <strong>{syncStatus.title}</strong>
                <small>
                  {syncStatus.lastSyncedAt
                    ? formatSavedAt(syncStatus.lastSyncedAt)
                    : syncStatus.modeLabel}
                </small>
              </div>
            </button>
            {openMenu === "sync" ? (
              <div className="topbar-popover sync-popover">
                <strong>同期状態</strong>
                <div className={`sync-status-card ${syncStatus.status}`}>
                  <span />
                  <div>
                    <strong>{syncStatus.title}</strong>
                    <p>{syncStatus.detail}</p>
                  </div>
                </div>
                <dl className="sync-meta">
                  <div>
                    <dt>保存範囲</dt>
                    <dd>{syncStatus.scopeLabel}</dd>
                  </div>
                  <div>
                    <dt>保存先</dt>
                    <dd>{syncStatus.providerLabel}</dd>
                  </div>
                  <div>
                    <dt>接続</dt>
                    <dd>{syncStatus.endpointLabel}</dd>
                  </div>
                  <div>
                    <dt>未同期</dt>
                    <dd>{syncStatus.pendingChangeCount}件</dd>
                  </div>
                </dl>
                <div className="sync-mode-toggle" aria-label="API接続状態">
                  <button
                    className={apiConnectionMode === "online" ? "active" : ""}
                    onClick={() => onApiConnectionModeChange("online")}
                    type="button"
                  >
                    API online
                  </button>
                  <button
                    className={apiConnectionMode === "offline" ? "active" : ""}
                    onClick={() => onApiConnectionModeChange("offline")}
                    type="button"
                  >
                    API offline
                  </button>
                </div>
                <section className="sync-queue" aria-label="API送信キュー">
                  <div className="sync-queue-heading">
                    <strong>API送信キュー</strong>
                    <span>{syncQueueItems.length}件</span>
                  </div>
                  {syncQueueItems.length > 0 ? (
                    <div className="sync-queue-list">
                      {syncQueueItems.map((item) => (
                        <article className={`sync-queue-item ${item.status}`} key={item.id}>
                          <span />
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.detail}</p>
                            {item.updatedAt ? <small>{formatSavedAt(item.updatedAt)}</small> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="sync-queue-empty">API送信待ちはありません。</p>
                  )}
                </section>
                <button
                  className="primary-button full"
                  onClick={() => {
                    setOpenMenu(null);
                    onSaveDraft();
                  }}
                  type="button"
                >
                  <CloudArrowUpIcon />
                  今すぐ保存
                </button>
                {syncStatus.status === "error" || syncStatus.status === "saving" ? (
                  <button
                    className="subtle-action full"
                    disabled={syncStatus.status === "saving"}
                    onClick={onRetryApiSync}
                    type="button"
                  >
                    <ArrowPathIcon />
                    API再送
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {!isDailyReportsContext && !isPersonalAnalyticsContext ? (
          <button
            className={
              hasUnsavedChanges ? "toolbar-button save-button dirty" : "toolbar-button save-button"
            }
            onClick={onSaveDraft}
            title={`${syncStatus.scopeLabel}を保存 (Ctrl/Cmd+S)`}
            type="button"
          >
            <CloudArrowUpIcon />
            保存
          </button>
        ) : null}
        {!isDailyReportsContext && !isPersonalAnalyticsContext ? (
          <button
            aria-label="ローカル保存を初期化"
            className="icon-button"
            onClick={onResetDraft}
            title="サンプルデータに戻す"
            type="button"
          >
            <ArrowPathIcon />
          </button>
        ) : null}
        {isProjectContext ? (
          <>
            <div className="topbar-action-wrap">
              <button
                className={openMenu === "share" ? "toolbar-button active" : "toolbar-button"}
                onClick={() => toggleMenu("share")}
                type="button"
              >
                <ShareIcon />
                共有
              </button>
              {openMenu === "share" ? (
                <div className="topbar-popover share-popover">
                  <strong>プロジェクト共有</strong>
                  <p>社内共有用のプロジェクトリンクです。</p>
                  <input
                    className="share-link"
                    onFocus={(event) => event.currentTarget.select()}
                    readOnly
                    title={projectUrl}
                    value={projectUrl}
                  />
                  <button className="primary-button full" onClick={copyProjectLink} type="button">
                    {shareCopyStatus === "copied" ? "コピー済み" : "リンクをコピー"}
                  </button>
                  {shareCopyStatus === "failed" ? (
                    <p className="share-error">
                      コピー権限がないため、リンク欄を選択してコピーしてください。
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="topbar-action-wrap">
              <button
                className={openMenu === "export" ? "toolbar-button active" : "toolbar-button"}
                onClick={() => toggleMenu("export")}
                type="button"
              >
                <ArrowDownTrayIcon />
                入出力
                <ChevronDownIcon />
              </button>
              {openMenu === "export" ? (
                <div className="topbar-popover export-popover">
                  <strong>入出力</strong>
                  <button onClick={() => importInputRef.current?.click()} type="button">
                    <ArrowUpTrayIcon />
                    プロジェクトJSONを読み込み
                  </button>
                  <input
                    ref={importInputRef}
                    accept=".json,application/json"
                    hidden
                    onChange={importProject}
                    type="file"
                  />
                  <button onClick={() => csvImportInputRef.current?.click()} type="button">
                    <ArrowUpTrayIcon />
                    タスクCSVを読み込み
                  </button>
                  <input
                    ref={csvImportInputRef}
                    accept=".csv,text/csv"
                    hidden
                    onChange={importTaskCsv}
                    type="file"
                  />
                  <button onClick={() => brabioImportInputRef.current?.click()} type="button">
                    <ArrowUpTrayIcon />
                    Brabio XLSXを読み込み
                  </button>
                  <input
                    ref={brabioImportInputRef}
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    hidden
                    onChange={importBrabioXlsx}
                    type="file"
                  />
                  <button onClick={() => exportProject("csv")} type="button">
                    <DocumentTextIcon />
                    タスクCSVを書き出し
                  </button>
                  <button onClick={() => exportProject("json")} type="button">
                    <DocumentTextIcon />
                    プロジェクトJSONを書き出し
                  </button>
                </div>
              ) : null}
            </div>
            <button
              className={projectSettingsOpen ? "icon-button active" : "icon-button"}
              aria-label="設定"
              onClick={() => {
                setOpenMenu(null);
                onProjectSettingsOpen();
              }}
              title="プロジェクト設定"
              type="button"
            >
              <Cog6ToothIcon />
            </button>
          </>
        ) : null}
        <div className="topbar-action-wrap">
          <button
            className={
              openMenu === "notifications"
                ? "icon-button has-badge active"
                : "icon-button has-badge"
            }
            aria-label="通知"
            onClick={() => toggleMenu("notifications")}
            title="通知"
            type="button"
          >
            <BellIcon />
            {notifications.length > 0 ? <span>{notifications.length}</span> : null}
          </button>
          {openMenu === "notifications" ? (
            <div className="topbar-popover notification-popover">
              <strong>通知</strong>
              {notifications.length > 0 ? (
                <div className="notification-list">
                  {notifications.map((notification) => (
                    <article
                      className={`notification-item ${notification.tone}`}
                      key={notification.id}
                    >
                      <span />
                      <div>
                        <strong>{notification.title}</strong>
                        <p>{notification.detail}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p>確認が必要な通知はありません。</p>
              )}
            </div>
          ) : null}
        </div>
        <div className="topbar-action-wrap">
          <button
            aria-label="アカウント"
            className={openMenu === "account" ? "account-button active" : "account-button"}
            onClick={() => toggleMenu("account")}
            title={`${currentUser.name}としてログイン中`}
            type="button"
          >
            <UserCircleIcon />
            <span>{currentUser.name}</span>
          </button>
          {openMenu === "account" ? (
            <div className="topbar-popover account-popover">
              <strong>アカウント</strong>
              <div className="account-summary">
                <UserCircleIcon />
                <div>
                  <strong>{currentUser.name}</strong>
                  <span>{currentUser.email}</span>
                  <small>{currentUser.role}</small>
                </div>
              </div>
              <button
                className="subtle-action full"
                onClick={() => {
                  setOpenMenu(null);
                  void onLogout();
                }}
                type="button"
              >
                <ArrowRightOnRectangleIcon />
                ログアウト
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function formatSavedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "保存日時不明";
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
