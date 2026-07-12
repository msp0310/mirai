import { ChevronRightIcon, MagnifyingGlassIcon, StarIcon } from "@heroicons/react/24/outline";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import type { Project, Team } from "../../../types/schedule";
import { filterAndOrderProjects, getTopbarContextPresentation } from "./topbarPresentation";
import type { TopbarContextMode } from "./types";

type TopbarContextPickerProps = {
  activeTeamId: string;
  allProjects: Project[];
  contextMode: TopbarContextMode;
  favorite: boolean;
  favoriteProjectIds: Set<string>;
  onFavoriteToggle: () => void;
  onMenuClose: () => void;
  onMenuOpen: () => void;
  onProjectChange: (projectId: string) => void;
  onProjectRestore: (projectId: string) => void;
  onTeamChange: (teamId: string) => void;
  open: boolean;
  project: Project;
  projects: Project[];
  teams: Team[];
};

/** チーム・案件の現在地と、キーボード操作可能な案件検索を表示します。 */
export function TopbarContextPicker({
  activeTeamId,
  allProjects,
  contextMode,
  favorite,
  favoriteProjectIds,
  onFavoriteToggle,
  onMenuClose,
  onMenuOpen,
  onProjectChange,
  onProjectRestore,
  onTeamChange,
  open,
  project,
  projects,
  teams,
}: TopbarContextPickerProps) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const projectRowRefs = useRef(new Map<string, HTMLButtonElement>());
  const presentation = getTopbarContextPresentation(contextMode, project);
  const projectItems = useMemo(
    () => filterAndOrderProjects(allProjects, teams, favoriteProjectIds, query),
    [allProjects, favoriteProjectIds, query, teams],
  );
  const teamById = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const hasUnassignedProjects = allProjects.some((item) => item.teamId == null);

  useEffect(() => {
    function handleGlobalProjectSearch(event: globalThis.KeyboardEvent) {
      if (!presentation.projectSearchAvailable) {
        return;
      }
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
      setQuery("");
      onMenuOpen();
    }
    window.addEventListener("keydown", handleGlobalProjectSearch);
    return () => window.removeEventListener("keydown", handleGlobalProjectSearch);
  }, [onMenuOpen, presentation.projectSearchAvailable]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [open]);

  function closeProjectSwitcher() {
    onMenuClose();
    setQuery("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function focusProjectRow(index: number) {
    const item = projectItems[index];
    if (item) {
      projectRowRefs.current.get(item.id)?.focus();
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusProjectRow(0);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeProjectSwitcher();
    }
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusProjectRow(Math.min(index + 1, projectItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else {
        focusProjectRow(index - 1);
      }
    } else if (event.key === "Escape") {
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
    onMenuClose();
    setQuery("");
  }

  return (
    <div className="title-block">
      <div className="workspace-title">
        <div className="title-stack">
          <div className="context-picker" aria-label="作業対象">
            <select
              aria-label="チーム"
              onChange={(event) => {
                onMenuClose();
                onTeamChange(event.target.value);
              }}
              value={activeTeamId}
            >
              {hasUnassignedProjects ? <option value="">未所属</option> : null}
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <ChevronRightIcon />
            {presentation.projectContext ? (
              <select
                aria-label="プロジェクト"
                onChange={(event) => {
                  onMenuClose();
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
              <span className="context-chip">{presentation.contextLabel}</span>
            )}
            {presentation.projectSearchAvailable ? (
              <div className="project-switcher-wrap">
                <button
                  aria-expanded={open}
                  aria-haspopup="dialog"
                  aria-label="プロジェクトを検索"
                  className={open ? "project-search-trigger active" : "project-search-trigger"}
                  onClick={() => {
                    setQuery("");
                    if (open) {
                      onMenuClose();
                    } else {
                      onMenuOpen();
                    }
                  }}
                  ref={triggerRef}
                  type="button"
                >
                  <MagnifyingGlassIcon />
                </button>
                {open ? (
                  <div
                    className="project-switcher-popover"
                    aria-label="プロジェクト切替"
                    role="dialog"
                  >
                    <div className="project-switcher-heading">
                      <strong>プロジェクト切替</strong>
                      <span>Ctrl/Cmd + K</span>
                    </div>
                    <input
                      aria-label="プロジェクト検索"
                      className="project-switcher-search"
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="プロジェクトNo.・案件名・チームで検索"
                      ref={searchInputRef}
                      value={query}
                    />
                    <div className="project-switcher-list">
                      {projectItems.map((item, index) => {
                        const itemTeam = item.teamId ? teamById.get(item.teamId) : undefined;
                        const archived = item.status === "archived";
                        const active = item.id === project.id;
                        return (
                          <button
                            className={
                              archived
                                ? "project-switcher-row archived"
                                : active
                                  ? "project-switcher-row active"
                                  : "project-switcher-row"
                            }
                            key={item.id}
                            onClick={() => selectProject(item)}
                            onKeyDown={(event) => handleRowKeyDown(event, index)}
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
                                {itemTeam?.name ?? "未所属"} / {item.name}
                              </span>
                            </div>
                            {archived ? (
                              <span className="project-switcher-status">復元</span>
                            ) : favoriteProjectIds.has(item.id) ? (
                              <StarIcon />
                            ) : null}
                          </button>
                        );
                      })}
                      {projectItems.length === 0 ? (
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
            <h1>{presentation.pageTitle}</h1>
            {presentation.projectContext ? (
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
  );
}
