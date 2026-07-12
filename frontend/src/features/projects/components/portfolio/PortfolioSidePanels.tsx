import { ExclamationTriangleIcon, FlagIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import type { ReactNode } from "react";

import { formatShortDate } from "../../../../lib/schedule";
import type { TeamWorkloadItem } from "../../projectPortfolioModel";
import type { ProjectPortfolioItem } from "../projectPortfolioTypes";

type PortfolioSidePanelsProps = {
  attentionItems: ProjectPortfolioItem[];
  maxWorkloadHours: number;
  nextMilestones: {
    milestone: ProjectPortfolioItem["nextMilestone"];
    project: ProjectPortfolioItem["project"];
  }[];
  onOpenProject: (projectId: string) => void;
  onOpenProjectIssues: (projectId: string) => void;
  teamDetailsComplete: boolean;
  teamWorkloads: TeamWorkloadItem[];
};

/** 要対応、直近マイルストーン、担当者別残作業を横断表示します。 */
export function PortfolioSidePanels({
  attentionItems,
  maxWorkloadHours,
  nextMilestones,
  onOpenProject,
  onOpenProjectIssues,
  teamDetailsComplete,
  teamWorkloads,
}: PortfolioSidePanelsProps) {
  return (
    <aside className="portfolio-side" aria-label="プロジェクト横断状況">
      <section className="portfolio-side-panel">
        <PanelTitle
          detail={`${attentionItems.length}件`}
          icon={<ExclamationTriangleIcon />}
          title="要対応"
        />
        <div className="portfolio-attention-list">
          {attentionItems.map((item) => (
            <div className="portfolio-attention-row" key={item.project.id}>
              <span>{item.delayedTasks.length > 0 ? "遅延" : "低進捗"}</span>
              <button
                className="portfolio-attention-project"
                onClick={() => onOpenProject(item.project.id)}
                type="button"
              >
                <strong>{item.project.workspace}</strong>
                <small>{item.delayedTasks[0]?.title ?? `進捗 ${item.progress}%`}</small>
              </button>
              <button
                className="portfolio-attention-action"
                onClick={() => onOpenProjectIssues(item.project.id)}
                type="button"
              >
                課題で対応
              </button>
            </div>
          ))}
          {attentionItems.length === 0 ? (
            <p className="portfolio-side-empty">要対応案件はありません。</p>
          ) : null}
        </div>
      </section>

      <section className="portfolio-side-panel">
        <PanelTitle
          detail={`${nextMilestones.length}件`}
          icon={<FlagIcon />}
          title="近いマイルストーン"
        />
        <div className="portfolio-milestone-list">
          {nextMilestones.map(({ milestone, project }) => (
            <button
              className="portfolio-milestone-row"
              key={`${project.id}-${milestone.title}-${milestone.start}`}
              onClick={() => onOpenProject(project.id)}
              type="button"
            >
              <span>{formatShortDate(milestone.start)}</span>
              <div>
                <strong>{milestone.title}</strong>
                <small>{project.workspace}</small>
              </div>
            </button>
          ))}
          {nextMilestones.length === 0 ? (
            <p className="portfolio-side-empty">予定中のマイルストーンはありません。</p>
          ) : null}
        </div>
      </section>

      {teamDetailsComplete ? (
        <section className="portfolio-side-panel">
          <PanelTitle
            detail={`${teamWorkloads.length}名`}
            icon={<UserGroupIcon />}
            title="チーム残作業"
          />
          <div className="portfolio-workload-list">
            {teamWorkloads.slice(0, 6).map((item) => (
              <button
                className="portfolio-workload-row"
                key={item.member.id}
                onClick={() => (item.topProject ? onOpenProject(item.topProject.id) : undefined)}
                type="button"
              >
                <span className="portfolio-member-dot" style={{ background: item.member.color }} />
                <div>
                  <strong>{item.member.name}</strong>
                  <small>
                    {Math.round(item.remainingHours)}h / {item.projectCount}案件
                    {item.delayedTaskCount > 0 ? ` / 遅延${item.delayedTaskCount}件` : ""}
                  </small>
                  <em>{item.topProject?.workspace ?? item.member.role}</em>
                  <div className="portfolio-workload-meter">
                    <span
                      style={{
                        width: `${Math.min((item.remainingHours / maxWorkloadHours) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </button>
            ))}
            {teamWorkloads.length === 0 ? (
              <p className="portfolio-side-empty">表示できる残作業はありません。</p>
            ) : null}
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function PanelTitle({ detail, icon, title }: { detail: string; icon: ReactNode; title: string }) {
  return (
    <div className="portfolio-panel-title">
      <div>
        {icon}
        <strong>{title}</strong>
      </div>
      <span>{detail}</span>
    </div>
  );
}
