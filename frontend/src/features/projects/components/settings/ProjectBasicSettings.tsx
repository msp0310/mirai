import { projectLifecycleOptions } from "../../../../lib/projects";
import type { ProjectLifecycleStatus, Team } from "../../../../types/schedule";
import type { ProjectSettingsDraft } from "../../hooks/useProjectSettingsEditor";

type ProjectBasicSettingsProps = {
  draft: ProjectSettingsDraft;
  onChange: (patch: Partial<ProjectSettingsDraft>) => void;
  onTeamChange: (teamId: string) => void;
  teams: Team[];
};

/** 案件識別情報、期間、次のマイルストーンを編集します。 */
export function ProjectBasicSettings({
  draft,
  onChange,
  onTeamChange,
  teams,
}: ProjectBasicSettingsProps) {
  return (
    <div className="settings-fields">
      <label>
        プロジェクト名
        <input
          onChange={(event) => onChange({ workspace: event.target.value })}
          value={draft.workspace}
        />
      </label>
      <label>
        プロジェクトNo.
        <input
          autoComplete="off"
          maxLength={64}
          onChange={(event) => onChange({ projectNo: event.target.value })}
          placeholder="例: PJ-2026-001"
          value={draft.projectNo}
        />
      </label>
      <label>
        所属チーム
        <select onChange={(event) => onTeamChange(event.target.value)} value={draft.teamId}>
          <option value="">未所属</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        プロジェクトステータス
        <select
          onChange={(event) =>
            onChange({ lifecycleStatus: event.target.value as ProjectLifecycleStatus })
          }
          value={draft.lifecycleStatus}
        >
          {projectLifecycleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        管理コード / 表示名
        <input onChange={(event) => onChange({ name: event.target.value })} value={draft.name} />
      </label>
      <div className="two-col">
        <label>
          開始日
          <input
            onChange={(event) => onChange({ rangeStart: event.target.value })}
            onInput={(event) => onChange({ rangeStart: event.currentTarget.value })}
            type="date"
            value={draft.rangeStart}
          />
        </label>
        <label>
          終了日
          <input
            onChange={(event) => onChange({ rangeEnd: event.target.value })}
            onInput={(event) => onChange({ rangeEnd: event.currentTarget.value })}
            type="date"
            value={draft.rangeEnd}
          />
        </label>
      </div>
      <label>
        次のマイルストーン
        <input
          onChange={(event) => onChange({ milestoneTitle: event.target.value })}
          value={draft.milestoneTitle}
        />
      </label>
      <label>
        マイルストーン日
        <input
          onChange={(event) => onChange({ milestoneDate: event.target.value })}
          onInput={(event) => onChange({ milestoneDate: event.currentTarget.value })}
          type="date"
          value={draft.milestoneDate}
        />
      </label>
    </div>
  );
}
