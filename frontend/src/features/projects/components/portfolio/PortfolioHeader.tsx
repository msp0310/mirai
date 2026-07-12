import { PlusIcon } from "@heroicons/react/24/outline";

import type { Team } from "../../../../types/schedule";

type TeamCard = {
  activeProjectCount: number;
  memberCount: number;
  team: Team | null;
};

type PortfolioHeaderProps = {
  activeTeamId: string;
  onCreateProject: () => void;
  onTeamChange: (teamId: string) => void;
  team?: Team;
  teamCards: TeamCard[];
};

/** 案件一覧の現在チーム、チーム切替、追加導線を表示します。 */
export function PortfolioHeader({
  activeTeamId,
  onCreateProject,
  onTeamChange,
  team,
  teamCards,
}: PortfolioHeaderProps) {
  return (
    <>
      <div className="portfolio-header">
        <div className="portfolio-heading">
          <span>選択中のチーム</span>
          <h2>{team?.name ?? "未所属"}</h2>
        </div>
        <div className="portfolio-header-actions">
          <button
            className="primary-button portfolio-add-button"
            onClick={onCreateProject}
            type="button"
          >
            <PlusIcon />
            プロジェクト追加
          </button>
        </div>
      </div>
      <div className="portfolio-team-strip" aria-label="チーム選択">
        {teamCards.map((item) => (
          <button
            aria-current={(item.team?.id ?? "") === activeTeamId ? "true" : undefined}
            className={
              (item.team?.id ?? "") === activeTeamId
                ? "portfolio-team-card active"
                : "portfolio-team-card"
            }
            key={item.team?.id ?? "unassigned"}
            onClick={() => onTeamChange(item.team?.id ?? "")}
            type="button"
          >
            <span>{item.team?.code ?? "未"}</span>
            <div>
              <strong>{item.team?.name ?? "未所属"}</strong>
              <small>
                {item.activeProjectCount}案件 / {item.memberCount}名
              </small>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
