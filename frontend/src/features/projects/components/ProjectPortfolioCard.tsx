import { ArrowRightIcon, FlagIcon, StarIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import type { CSSProperties } from "react";

import { projectLifecycleLabels, projectLifecycleOptions } from "../../../lib/projects";
import { formatShortDate, statusLabels } from "../../../lib/schedule";
import type { ProjectLifecycleStatus } from "../../../types/schedule";
import type { ProjectPortfolioItem } from "./projectPortfolioTypes";

type ProjectPortfolioCardProps = {
  active: boolean;
  item: ProjectPortfolioItem;
  onOpenProject: (projectId: string) => void;
  onSelectProject: (projectId: string) => void;
  onToggleFavoriteProject: (projectId: string) => void;
  onUpdateProjectLifecycleStatus: (projectId: string, status: ProjectLifecycleStatus) => void;
};

/** 案件一覧で選択・遷移・概要確認を行うカードです。 */
export function ProjectPortfolioCard({
  active,
  item,
  onOpenProject,
  onSelectProject,
  onToggleFavoriteProject,
  onUpdateProjectLifecycleStatus,
}: ProjectPortfolioCardProps) {
  const tone =
    item.delayedTasks.length > 0
      ? "hot"
      : item.progress >= 70
        ? "good"
        : item.progress === 0
          ? "neutral"
          : "blue";

  return (
    <article
      aria-label={`${item.project.workspace} を選択`}
      className={active ? "portfolio-card active" : "portfolio-card"}
      onClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button, select, input, a")) {
          return;
        }
        onSelectProject(item.project.id);
      }}
      onDoubleClick={(event) => {
        if (event.target instanceof Element && event.target.closest("button, select, input, a")) {
          return;
        }
        onOpenProject(item.project.id);
      }}
    >
      <header className="portfolio-card-header">
        <div>
          <span>{item.team?.name ?? item.project.teamId}</span>
          <strong>{item.project.workspace}</strong>
          <small className="portfolio-project-no">
            プロジェクトNo. {item.project.projectNo || "未設定"}
          </small>
        </div>
        <div className="portfolio-card-actions">
          <select
            aria-label={`${item.project.workspace} のステータス`}
            className={`portfolio-lifecycle-select ${item.lifecycleStatus}`}
            onChange={(event) =>
              onUpdateProjectLifecycleStatus(
                item.project.id,
                event.target.value as ProjectLifecycleStatus,
              )
            }
            value={item.lifecycleStatus}
          >
            {projectLifecycleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            aria-label={item.favorite ? "お気に入りから外す" : "お気に入りに追加"}
            className={item.favorite ? "portfolio-favorite active" : "portfolio-favorite"}
            onClick={() => onToggleFavoriteProject(item.project.id)}
            title={item.favorite ? "お気に入りから外す" : "お気に入りに追加"}
            type="button"
          >
            <StarIcon />
          </button>
        </div>
      </header>

      <div className={`portfolio-lifecycle-banner ${item.lifecycleStatus}`}>
        <span>{projectLifecycleLabels[item.lifecycleStatus]}</span>
        <strong>{item.project.name}</strong>
      </div>

      <div className="portfolio-card-metrics">
        <div className={`portfolio-progress-ring ${tone}`}>{item.progress}%</div>
        <dl>
          <div>
            <dt>タスク</dt>
            <dd>
              {item.completedCount}/{item.taskCount}
            </dd>
          </div>
          <div>
            <dt>期間</dt>
            <dd>{item.workDays == null ? "詳細読込後" : `${item.workDays}稼働日`}</dd>
          </div>
          <div>
            <dt>体制</dt>
            <dd>{item.memberCount}名</dd>
          </div>
        </dl>
      </div>

      <div className="portfolio-card-progress">
        <span style={{ width: `${item.progress}%` }} />
      </div>

      <div className="portfolio-card-detail">
        <div>
          <FlagIcon />
          <span>
            {formatShortDate(item.nextMilestone.start)} {item.nextMilestone.title}
          </span>
        </div>
        <div>
          <UserGroupIcon />
          <span>
            {item.delayedTasks.length > 0
              ? `遅延 ${item.delayedTasks.length}件`
              : statusLabels[item.nextMilestone.status]}
          </span>
        </div>
      </div>

      <div className="portfolio-card-members">
        <UserGroupIcon />
        <div className="portfolio-member-stack" aria-hidden="true">
          {item.assignedMembers.slice(0, 4).map((member) => (
            <span key={member.id} style={{ "--avatar-color": member.color } as CSSProperties}>
              {member.initials}
            </span>
          ))}
        </div>
      </div>

      <footer className="portfolio-card-footer">
        <span>
          {formatShortDate(item.project.rangeStart)} - {formatShortDate(item.project.rangeEnd)}
        </span>
        <button onClick={() => onOpenProject(item.project.id)} type="button">
          Ganttへ
          <ArrowRightIcon />
        </button>
      </footer>
    </article>
  );
}
