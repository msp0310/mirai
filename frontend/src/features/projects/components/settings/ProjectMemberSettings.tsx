import type { CSSProperties } from "react";

import { isMemberActive } from "../../../../lib/members";
import { projectLifecycleLabels } from "../../../../lib/projects";
import type { Member, ProjectRole } from "../../../../types/schedule";
import type { ProjectSettingsDraft } from "../../hooks/useProjectSettingsEditor";

type ProjectMemberSettingsProps = {
  activeMemberCount: number;
  members: Member[];
  onRoleChange: (memberId: string, role: ProjectRole) => void;
  onToggleMember: (memberId: string) => void;
  draft: ProjectSettingsDraft;
};

/** 所属チーム内の要員と案件権限を編集します。 */
export function ProjectMemberSettings({
  activeMemberCount,
  draft,
  members,
  onRoleChange,
  onToggleMember,
}: ProjectMemberSettingsProps) {
  return (
    <section className="settings-card">
      <div className="settings-card-heading">
        <strong>プロジェクト要員</strong>
        <span>
          {projectLifecycleLabels[draft.lifecycleStatus ?? "planning"]} / 有効{activeMemberCount}名
        </span>
      </div>
      <div className="team-member-checks project-member-checks">
        {members.map((member) => {
          const selected = draft.memberIds.includes(member.id);
          return (
            <label className={isMemberActive(member) ? "" : "inactive"} key={member.id}>
              <input
                checked={selected}
                onChange={() => onToggleMember(member.id)}
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
              {selected ? (
                <select
                  aria-label={`${member.name}のプロジェクト権限`}
                  onChange={(event) => onRoleChange(member.id, event.target.value as ProjectRole)}
                  value={
                    draft.memberships.find((item) => item.memberId === member.id)?.role ?? "member"
                  }
                >
                  <option value="owner">PM / オーナー</option>
                  <option value="planner">PL / 計画編集</option>
                  <option value="member">メンバー / 実績入力</option>
                  <option value="viewer">閲覧者</option>
                </select>
              ) : null}
            </label>
          );
        })}
      </div>
    </section>
  );
}
