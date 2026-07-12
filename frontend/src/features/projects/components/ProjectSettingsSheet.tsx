import { type CSSProperties, useEffect, useState } from "react";

import { isMemberActive } from "../../../lib/members";
import {
  getProjectLifecycleStatus,
  projectLifecycleLabels,
  projectLifecycleOptions,
} from "../../../lib/projects";
import type {
  Member,
  Project,
  ProjectLifecycleStatus,
  ProjectMembership,
  ProjectRole,
  Team,
} from "../../../types/schedule";

type ProjectSettingsPageProps = {
  activeProjectCount: number;
  members: Member[];
  onArchiveProject: (projectId: string) => void;
  onSaveProject: (project: Project) => void;
  project: Project;
  team?: Team;
  teams: Team[];
};

/** 選択中プロジェクトの名称や期間などを編集するページです。 */
export function ProjectSettingsPage({
  activeProjectCount,
  members,
  onArchiveProject,
  onSaveProject,
  project,
  team,
  teams,
}: ProjectSettingsPageProps) {
  const [name, setName] = useState(project.name);
  const [workspace, setWorkspace] = useState(project.workspace);
  const [projectNo, setProjectNo] = useState(project.projectNo ?? "");
  const [projectTeamId, setProjectTeamId] = useState(project.teamId ?? "");
  const [lifecycleStatus, setLifecycleStatus] = useState<ProjectLifecycleStatus>(
    getProjectLifecycleStatus(project),
  );
  const [projectMemberIds, setProjectMemberIds] = useState<string[]>(
    project.memberIds ?? team?.memberIds ?? [],
  );
  const [projectMemberships, setProjectMemberships] = useState<ProjectMembership[]>(
    project.memberships ??
      (project.memberIds ?? team?.memberIds ?? []).map((memberId) => ({
        memberId,
        role: "member",
      })),
  );
  const [rangeStart, setRangeStart] = useState(project.rangeStart);
  const [rangeEnd, setRangeEnd] = useState(project.rangeEnd);
  const [milestoneTitle, setMilestoneTitle] = useState(project.nextMilestone.title);
  const [milestoneDate, setMilestoneDate] = useState(project.nextMilestone.date);
  const [archiveConfirm, setArchiveConfirm] = useState(false);

  useEffect(() => {
    setName(project.name);
    setWorkspace(project.workspace);
    setProjectNo(project.projectNo ?? "");
    setProjectTeamId(project.teamId ?? "");
    setLifecycleStatus(getProjectLifecycleStatus(project));
    setProjectMemberIds(project.memberIds ?? team?.memberIds ?? []);
    setProjectMemberships(
      project.memberships ??
        (project.memberIds ?? team?.memberIds ?? []).map((memberId) => ({
          memberId,
          role: "member",
        })),
    );
    setRangeStart(project.rangeStart);
    setRangeEnd(project.rangeEnd);
    setMilestoneTitle(project.nextMilestone.title);
    setMilestoneDate(project.nextMilestone.date);
    setArchiveConfirm(false);
  }, [project, team?.memberIds]);

  const invalidRange = rangeStart > rangeEnd;
  const milestoneOutside = milestoneDate < rangeStart || milestoneDate > rangeEnd;
  const archiveDisabled = activeProjectCount <= 1;
  const selectedProjectTeam = teams.find((item) => item.id === projectTeamId);
  const projectAssignableMembers = members.filter((member) =>
    selectedProjectTeam?.memberIds.includes(member.id),
  );
  const activeProjectMemberCount = projectAssignableMembers.filter(
    (member) => projectMemberIds.includes(member.id) && isMemberActive(member),
  ).length;

  function changeProjectTeamId(teamId: string) {
    setProjectTeamId(teamId);
    const nextTeam = teams.find((item) => item.id === teamId);
    setProjectMemberIds(nextTeam?.memberIds ?? []);
    setProjectMemberships(
      (nextTeam?.memberIds ?? []).map((memberId) => ({ memberId, role: "member" })),
    );
  }

  function toggleProjectMember(memberId: string) {
    setProjectMemberIds((current) => {
      const enabled = !current.includes(memberId);
      setProjectMemberships((memberships) =>
        enabled
          ? [
              ...memberships.filter((item) => item.memberId !== memberId),
              { memberId, role: "member" },
            ]
          : memberships.filter((item) => item.memberId !== memberId),
      );
      return enabled ? [...current, memberId] : current.filter((id) => id !== memberId);
    });
  }

  function changeProjectRole(memberId: string, role: ProjectRole) {
    setProjectMemberships((current) => [
      ...current.filter((item) => item.memberId !== memberId),
      { memberId, role },
    ]);
  }

  function saveProject() {
    if (invalidRange) {
      return;
    }
    const availableMemberIds = new Set(selectedProjectTeam?.memberIds ?? team?.memberIds);
    onSaveProject({
      ...project,
      lifecycleStatus,
      memberIds: projectMemberIds.filter((memberId) => availableMemberIds.has(memberId)),
      memberships: projectMemberships.filter(
        (item) => projectMemberIds.includes(item.memberId) && availableMemberIds.has(item.memberId),
      ),
      teamId: projectTeamId || null,
      name: name.trim() || project.name,
      projectNo: projectNo.trim() || null,
      workspace: workspace.trim() || project.workspace,
      rangeStart,
      rangeEnd,
      nextMilestone: {
        title: milestoneTitle.trim() || "次のマイルストーン",
        date: milestoneDate,
      },
    });
  }

  return (
    <section className="project-settings-page" aria-label="プロジェクト設定">
      <div className="master-settings-page-header">
        <div>
          <span>{team?.name ?? "未所属"}</span>
          <h2>プロジェクト設定</h2>
        </div>
        <strong>{project.workspace}</strong>
      </div>

      <div className="master-settings-summary project-settings-summary">
        <div>
          <span>プロジェクトNo.</span>
          <strong>{projectNo || "未設定"}</strong>
        </div>
        <div>
          <span>ステータス</span>
          <strong>{projectLifecycleLabels[lifecycleStatus]}</strong>
        </div>
        <div>
          <span>プロジェクト要員</span>
          <strong>{activeProjectMemberCount}名</strong>
        </div>
        <div>
          <span>期間</span>
          <strong>{formatProjectRange(rangeStart, rangeEnd)}</strong>
        </div>
      </div>

      <div className="project-settings-content">
        <div className="settings-fields">
          <label>
            プロジェクト名
            <input onChange={(event) => setWorkspace(event.target.value)} value={workspace} />
          </label>
          <label>
            プロジェクトNo.
            <input
              autoComplete="off"
              maxLength={64}
              onChange={(event) => setProjectNo(event.target.value)}
              placeholder="例: PJ-2026-001"
              value={projectNo}
            />
          </label>
          <label>
            所属チーム
            <select
              onChange={(event) => changeProjectTeamId(event.target.value)}
              value={projectTeamId}
            >
              <option value="">未所属</option>
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            プロジェクトステータス
            <select
              onChange={(event) => setLifecycleStatus(event.target.value as ProjectLifecycleStatus)}
              value={lifecycleStatus}
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
            <input onChange={(event) => setName(event.target.value)} value={name} />
          </label>
          <div className="two-col">
            <label>
              開始日
              <input
                onChange={(event) => setRangeStart(event.target.value)}
                onInput={(event) => setRangeStart(event.currentTarget.value)}
                type="date"
                value={rangeStart}
              />
            </label>
            <label>
              終了日
              <input
                onChange={(event) => setRangeEnd(event.target.value)}
                onInput={(event) => setRangeEnd(event.currentTarget.value)}
                type="date"
                value={rangeEnd}
              />
            </label>
          </div>
          <label>
            次のマイルストーン
            <input
              onChange={(event) => setMilestoneTitle(event.target.value)}
              value={milestoneTitle}
            />
          </label>
          <label>
            マイルストーン日
            <input
              onChange={(event) => setMilestoneDate(event.target.value)}
              onInput={(event) => setMilestoneDate(event.currentTarget.value)}
              type="date"
              value={milestoneDate}
            />
          </label>
        </div>

        <section className="settings-card">
          <div className="settings-card-heading">
            <strong>プロジェクト要員</strong>
            <span>
              {projectLifecycleLabels[lifecycleStatus]} / 有効
              {activeProjectMemberCount}名
            </span>
          </div>
          <div className="team-member-checks project-member-checks">
            {projectAssignableMembers.map((member) => (
              <label className={isMemberActive(member) ? "" : "inactive"} key={member.id}>
                <input
                  checked={projectMemberIds.includes(member.id)}
                  onChange={() => toggleProjectMember(member.id)}
                  type="checkbox"
                />
                <span style={{ "--avatar-color": member.color } as CSSProperties}>
                  {member.initials}
                </span>
                <strong>{member.name}</strong>
                <small>
                  {member.role}
                  {!isMemberActive(member) ? " / 休止中" : ""}
                </small>
                {projectMemberIds.includes(member.id) ? (
                  <select
                    aria-label={`${member.name}のプロジェクト権限`}
                    onChange={(event) =>
                      changeProjectRole(member.id, event.target.value as ProjectRole)
                    }
                    value={
                      projectMemberships.find((item) => item.memberId === member.id)?.role ??
                      "member"
                    }
                  >
                    <option value="owner">PM / オーナー</option>
                    <option value="planner">PL / 計画編集</option>
                    <option value="member">メンバー / 実績入力</option>
                    <option value="viewer">閲覧者</option>
                  </select>
                ) : null}
              </label>
            ))}
          </div>
        </section>

        <div className="settings-warning-stack">
          {invalidRange ? (
            <p className="settings-warning">終了日は開始日以降にしてください。</p>
          ) : null}
          {!invalidRange && milestoneOutside ? (
            <p className="settings-warning muted">次のマイルストーンがプロジェクト期間外です。</p>
          ) : null}
        </div>

        <section className="settings-card archive-card">
          <div className="settings-card-heading">
            <strong>プロジェクト整理</strong>
            <span>{archiveDisabled ? "最後の有効案件" : "アーカイブ"}</span>
          </div>
          <p>
            完了・保留になった案件を通常のチーム選択から外します。
            データは残り、プロジェクト検索から復元できます。
          </p>
          {archiveConfirm ? (
            <div className="archive-confirm">
              <strong>{project.workspace} をアーカイブしますか？</strong>
              <span>次の有効プロジェクトへ移動します。</span>
              <div>
                <button
                  className="subtle-action"
                  onClick={() => setArchiveConfirm(false)}
                  type="button"
                >
                  キャンセル
                </button>
                <button
                  className="primary-button danger"
                  onClick={() => onArchiveProject(project.id)}
                  type="button"
                >
                  アーカイブして移動
                </button>
              </div>
            </div>
          ) : (
            <button
              className="subtle-action danger"
              disabled={archiveDisabled}
              onClick={() => setArchiveConfirm(true)}
              type="button"
            >
              アーカイブ
            </button>
          )}
        </section>

        <div className="settings-actions">
          <button
            className="primary-button"
            disabled={invalidRange}
            onClick={saveProject}
            type="button"
          >
            保存
          </button>
        </div>
      </div>
    </section>
  );
}

function formatProjectRange(start: string, end: string) {
  return `${formatShortDate(start)} - ${formatShortDate(end)}`;
}

function formatShortDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}
